import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { VllmProvider } from './vllm.provider';

function makeProvider(env: Record<string, string | number | undefined> = {}): VllmProvider {
  const cfg = { get: (k: string) => env[k] } as unknown as ConfigService;
  return new VllmProvider(cfg);
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

describe('VllmProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('providerName is "vllm" and configured reflects VLLM_URL presence', () => {
    expect(makeProvider({}).providerName).toBe('vllm');
    expect(makeProvider({}).configured).toBe(false);
    expect(makeProvider({ VLLM_URL: 'http://vllm:8000' }).configured).toBe(true);
  });

  it('throws 503 when generate() runs unconfigured', async () => {
    await expect(
      makeProvider({}).generate({ findings: 'x', reportTitle: 'CT' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('hits /v1/chat/completions with stream=true and accumulates delta.content', async () => {
    // OpenAI-style SSE: `data: { … }` lines terminated by `data: [DONE]`.
    const sse =
      'data: {"choices":[{"delta":{"content":"TÉC"},"finish_reason":null}]}\n' +
      'data: {"choices":[{"delta":{"content":"NICA\\n"},"finish_reason":null}]}\n' +
      'data: {"choices":[{"delta":{"content":"HALLAZGOS"},"finish_reason":null}]}\n' +
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n' +
      'data: [DONE]\n';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom(sse),
      text: async () => '',
    });
    (global as any).fetch = fetchMock;
    const provider = makeProvider({
      VLLM_URL: 'http://vllm:8000/',
      VLLM_MODEL: 'llama-test',
    });

    const out = await provider.generate({ findings: 'lorem ipsum', reportTitle: 'CT' });
    expect(out.text).toBe('TÉCNICA\nHALLAZGOS');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://vllm:8000/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.stream).toBe(true);
    expect(body.model).toBe('llama-test');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toContain('lorem ipsum');
  });

  it('attaches Authorization: Bearer when VLLM_API_KEY is set', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom('data: [DONE]\n'),
      text: async () => '',
    });
    (global as any).fetch = fetchMock;
    const provider = makeProvider({
      VLLM_URL: 'http://vllm:8000',
      VLLM_API_KEY: 'secret-token',
    });
    await provider.generate({ findings: 'x', reportTitle: 'CT' });
    expect(fetchMock.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer secret-token' }),
    );
  });

  it('streaming yields fragments in order and reports the summary on close', async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"foo"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"bar"}}]}\n' +
      'data: [DONE]\n';
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom(sse),
      text: async () => '',
    });
    const provider = makeProvider({ VLLM_URL: 'http://vllm:8000' });
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

  it('maps non-2xx upstream to ServiceUnavailableException', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'engine offline',
    });
    await expect(
      makeProvider({ VLLM_URL: 'http://vllm:8000' }).generate({
        findings: 'x',
        reportTitle: 'CT',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('surfaces inline {"error":{"message":"…"}} as ServiceUnavailable', async () => {
    const sse = 'data: {"error":{"message":"out of memory"}}\n';
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom(sse),
      text: async () => '',
    });
    await expect(
      makeProvider({ VLLM_URL: 'http://vllm:8000' }).generate({
        findings: 'x',
        reportTitle: 'CT',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
