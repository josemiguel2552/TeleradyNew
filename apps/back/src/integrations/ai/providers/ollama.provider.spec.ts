import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { OllamaProvider } from './ollama.provider';

function makeProvider(env: Record<string, string | number | undefined> = {}): OllamaProvider {
  const cfg = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  return new OllamaProvider(cfg);
}

function streamFrom(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe('OllamaProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('providerName is "ollama" and configured reflects OLLAMA_URL presence', () => {
    expect(makeProvider({}).providerName).toBe('ollama');
    expect(makeProvider({}).configured).toBe(false);
    expect(makeProvider({ OLLAMA_URL: 'http://ollama:11434' }).configured).toBe(true);
  });

  it('throws 503 when generate() runs unconfigured', async () => {
    await expect(
      makeProvider({}).generate({ findings: 'x', reportTitle: 'CT' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('hits /api/generate with the configured model and accumulates NDJSON fragments', async () => {
    const ndjson =
      '{"response":"Téc","done":false}\n' +
      '{"response":"nica\\n","done":false}\n' +
      '{"response":"Halla","done":false}\n' +
      '{"response":"zgos","done":false}\n' +
      '{"response":"","done":true}\n';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom(ndjson),
      text: async () => '',
    });
    (global as any).fetch = fetchMock;
    const provider = makeProvider({
      OLLAMA_URL: 'http://ollama:11434/',
      OLLAMA_MODEL: 'llama3.1:8b-instruct',
    });

    const out = await provider.generate({ findings: 'lorem ipsum', reportTitle: 'CT' });
    expect(out.text).toBe('Técnica\nHallazgos');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://ollama:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe('llama3.1:8b-instruct');
    expect(body.stream).toBe(true);
    expect(body.prompt).toContain('lorem ipsum');
    expect(body.prompt).toContain('Report title: CT');
  });

  it('streaming yields each non-empty fragment in order', async () => {
    const ndjson =
      '{"response":"foo","done":false}\n' +
      '{"response":"","done":false}\n' + // empty - skipped
      '{"response":"bar","done":false}\n' +
      '{"response":"","done":true}\n';
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom(ndjson),
      text: async () => '',
    });
    const provider = makeProvider({ OLLAMA_URL: 'http://ollama:11434' });
    const chunks: string[] = [];
    let summary: { charCount: number } | null = null;
    for await (const c of provider.generateStream(
      { findings: 'x', reportTitle: 'CT' },
      (s) => {
        summary = s;
      },
    )) {
      chunks.push(c.text);
    }
    expect(chunks).toEqual(['foo', 'bar']);
    expect(summary!.charCount).toBe(6);
  });

  it('maps a non-2xx upstream to ServiceUnavailableException', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'model missing',
    });
    const provider = makeProvider({ OLLAMA_URL: 'http://ollama:11434' });
    await expect(
      provider.generate({ findings: 'x', reportTitle: 'CT' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('surfaces an inline {"error": "..."} line as ServiceUnavailable', async () => {
    const ndjson = '{"error":"model llama3.1 not found"}\n';
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom(ndjson),
      text: async () => '',
    });
    const provider = makeProvider({ OLLAMA_URL: 'http://ollama:11434' });
    await expect(
      provider.generate({ findings: 'x', reportTitle: 'CT' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uses the English system prompt when language=en', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom('{"response":"x","done":true}\n'),
      text: async () => '',
    });
    (global as any).fetch = fetchMock;
    const provider = makeProvider({ OLLAMA_URL: 'http://ollama:11434' });
    await provider.generate({ findings: 'lorem', reportTitle: 'CT', language: 'en' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.prompt).toContain('You are a radiologist');
  });
});
