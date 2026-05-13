import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { RadiogenAIClient } from './radiogenai.client';

function makeClient(env: Record<string, string | number | undefined> = {}): RadiogenAIClient {
  const cfg = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  return new RadiogenAIClient(cfg);
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

describe('RadiogenAIClient', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('reports configured=false when URL or key are missing', () => {
    expect(makeClient({}).configured).toBe(false);
    expect(makeClient({ RADIOGENAI_URL: 'http://x' }).configured).toBe(false);
    expect(
      makeClient({
        RADIOGENAI_URL: 'http://x',
        RADIOGENAI_API_KEY: 'k'.repeat(20),
      }).configured,
    ).toBe(true);
  });

  it('throws 503 when generate() is called on an unconfigured client', async () => {
    await expect(
      makeClient({}).generate({ findings: 'x', reportTitle: 'CT' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('forwards the API key, strips trailing slash, and accumulates the streaming body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom('data: hola\ndata: mundo\n'),
      text: async () => '',
    });
    (global as any).fetch = fetchMock;

    const client = makeClient({
      RADIOGENAI_URL: 'https://radiogenai.example.com/',
      RADIOGENAI_API_KEY: 'a'.repeat(40),
      RADIOGENAI_DEFAULT_LANGUAGE: 'es',
      RADIOGENAI_TIMEOUT_MS: 5_000,
    });

    const out = await client.generate({
      findings: 'lorem',
      reportTitle: 'CT',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://radiogenai.example.com/genreport',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'a'.repeat(40),
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(out.text).toBe('hola\nmundo');
    expect(out.charCount).toBe('hola\nmundo'.length);
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('maps a non-2xx upstream response to ServiceUnavailableException', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'upstream broken',
    });

    const client = makeClient({
      RADIOGENAI_URL: 'https://radiogenai.example.com',
      RADIOGENAI_API_KEY: 'k'.repeat(40),
    });
    await expect(
      client.generate({ findings: 'lorem', reportTitle: 'CT' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('respects the configured language override on the request body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom('ok'),
      text: async () => '',
    });
    (global as any).fetch = fetchMock;

    const client = makeClient({
      RADIOGENAI_URL: 'https://radiogenai.example.com',
      RADIOGENAI_API_KEY: 'k'.repeat(40),
      RADIOGENAI_DEFAULT_LANGUAGE: 'es',
    });
    await client.generate({ findings: 'lorem', reportTitle: 'CT', language: 'en' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.language).toBe('en');
    expect(body.findings).toBe('lorem');
    expect(body.report_title).toBe('CT');
  });
});
