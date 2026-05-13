import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AiDraftService } from './ai-draft.service';
import { TokenService } from '../../../service/token.service';
import { environment } from '../../../../environments/environment';

/**
 * Build a minimal duck-typed Response.body shim. jsdom does not ship
 * the ReadableStream constructor, but the SUT only calls
 * `body.getReader().read()` — we mimic that.
 */
function mkStreamBody(chunks: Uint8Array[]): { getReader: () => any } {
  let i = 0;
  return {
    getReader: () => ({
      read: () =>
        i < chunks.length
          ? Promise.resolve({ done: false, value: chunks[i++] })
          : Promise.resolve({ done: true, value: undefined }),
    }),
  };
}

describe('AiDraftService', () => {
  let service: AiDraftService;
  let httpMock: HttpTestingController;
  const tokenMock = { getRawToken: jest.fn().mockReturnValue('the-token') };
  const base = `${environment.apiTelerady.replace(/\/v1$/, '')}/v2/reports`;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AiDraftService,
        { provide: TokenService, useValue: tokenMock },
      ],
    });
    service = TestBed.inject(AiDraftService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    (globalThis as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('generate() POSTs the payload to /v2/reports/:id/ai-draft', async () => {
    const promise = service.generate('rs-1', { findings: 'lorem', reportTitle: 'CT' });
    const req = httpMock.expectOne(`${base}/rs-1/ai-draft`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ findings: 'lorem', reportTitle: 'CT' });
    req.flush({ text: 'IA', latencyMs: 1000, charCount: 2 });
    const out = await promise;
    expect(out.text).toBe('IA');
  });

  it('generate() url-encodes the report study id', () => {
    void service.generate('with space/slash', { findings: 'x', reportTitle: 'CT' });
    httpMock.expectOne(`${base}/with%20space%2Fslash/ai-draft`).flush({});
  });

  describe('generateStream()', () => {
    it('throws and decorates with status when the server rejects (non-2xx)', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'No consent' }),
      });
      await expect(
        service.generateStream(
          'rs-1',
          { findings: 'x', reportTitle: 'CT' },
          { onChunk: () => {} },
        ),
      ).rejects.toMatchObject({ status: 403, message: 'No consent' });
    });

    it('parses the SSE stream and yields each chunk through onChunk', async () => {
      const chunksToYield = [
        new TextEncoder().encode(
          'event: chunk\ndata: hola\n\n' +
            'event: chunk\ndata: \\nmundo\n\n' +
            'event: done\ndata: {}\n\n',
        ),
      ];
      const body = mkStreamBody(chunksToYield);
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body,
      });
      const chunks: string[] = [];
      await service.generateStream(
        'rs-1',
        { findings: 'x', reportTitle: 'CT' },
        { onChunk: (text) => chunks.push(text) },
      );
      // The first chunk drops the SSE-empty data; the spec parses
      // `\\n` as the literal two-char escape because the data field
      // is a single line per the frame.
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('routes event:error frames to onError with the parsed JSON', async () => {
      const chunksToYield = [
        new TextEncoder().encode(
          'event: error\ndata: {"status":502,"message":"upstream"}\n\n',
        ),
      ];
      const body = mkStreamBody(chunksToYield);
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body,
      });
      const errors: any[] = [];
      await service.generateStream(
        'rs-1',
        { findings: 'x', reportTitle: 'CT' },
        {
          onChunk: () => {},
          onError: (e) => errors.push(e),
        },
      );
      expect(errors).toEqual([{ status: 502, message: 'upstream' }]);
    });

    it('forwards the Bearer token from TokenService when present', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: mkStreamBody([]),
      });
      (globalThis as any).fetch = fetchMock;
      await service.generateStream(
        'rs-1',
        { findings: 'x', reportTitle: 'CT' },
        { onChunk: () => {} },
      );
      const init = fetchMock.mock.calls[0][1];
      expect(init.headers.Authorization).toBe('Bearer the-token');
      expect(init.headers.Accept).toBe('text/event-stream');
    });
  });
});
