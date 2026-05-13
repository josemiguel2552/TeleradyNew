import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { RadiogenAIProvider } from './radiogenai.provider';

function makeProvider(env: Record<string, string | number | undefined> = {}): RadiogenAIProvider {
  const cfg = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  return new RadiogenAIProvider(cfg);
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

describe('RadiogenAIProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('providerName is "radiogenai" and configured reflects env presence', () => {
    expect(makeProvider({}).configured).toBe(false);
    expect(
      makeProvider({
        RADIOGENAI_URL: 'http://x',
        RADIOGENAI_API_KEY: 'k'.repeat(20),
      }).configured,
    ).toBe(true);
    expect(makeProvider({}).providerName).toBe('radiogenai');
  });

  it('throws 503 when generate() runs unconfigured', async () => {
    await expect(
      makeProvider({}).generate({ findings: 'x', reportTitle: 'CT' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('forwards x-api-key and accumulates the SSE body for generate()', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom('data: hola\ndata: mundo\n'),
      text: async () => '',
    });
    (global as any).fetch = fetchMock;
    const provider = makeProvider({
      RADIOGENAI_URL: 'https://x.test/',
      RADIOGENAI_API_KEY: 'k'.repeat(40),
    });

    const out = await provider.generate({ findings: 'lorem', reportTitle: 'CT' });
    expect(out.text).toBe('hola\nmundo');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://x.test/genreport',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'k'.repeat(40) }),
      }),
    );
  });

  it('streaming yields each non-empty line and reports the summary on close', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom('data: hola\ndata: \ndata: mundo\n'),
      text: async () => '',
    });
    const provider = makeProvider({
      RADIOGENAI_URL: 'https://x.test',
      RADIOGENAI_API_KEY: 'k'.repeat(40),
    });
    const chunks: string[] = [];
    let summary: { latencyMs: number; charCount: number } | null = null;
    for await (const c of provider.generateStream(
      { findings: 'x', reportTitle: 'CT' },
      (s) => {
        summary = s;
      },
    )) {
      chunks.push(c.text);
    }
    expect(chunks).toEqual(['hola', '\nmundo']);
    expect(summary).not.toBeNull();
    expect(summary!.charCount).toBe('hola'.length + '\nmundo'.length);
  });

  it('maps non-2xx upstream to ServiceUnavailableException', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'upstream broken',
    });
    const provider = makeProvider({
      RADIOGENAI_URL: 'https://x.test',
      RADIOGENAI_API_KEY: 'k'.repeat(40),
    });
    await expect(
      provider.generate({ findings: 'x', reportTitle: 'CT' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
