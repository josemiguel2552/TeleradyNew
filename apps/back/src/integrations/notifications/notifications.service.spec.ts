import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { NotificationsService } from './notifications.service';

function makeService(env: Record<string, string | undefined> = {}): NotificationsService {
  const cfg = { get: (k: string) => env[k] } as unknown as ConfigService;
  return new NotificationsService(cfg);
}

describe('NotificationsService.sendEmail', () => {
  it('logs the email payload structurally without throwing', async () => {
    const svc = makeService({ EMAIL_FROM: 'ops@telerady.es' });
    await expect(
      svc.sendEmail({ to: 'rad@x.es', subject: 's', text: 'body' }),
    ).resolves.toBeUndefined();
  });
});

describe('NotificationsService.fireWebhook', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('skips when WEBHOOK_OUTGOING_SECRET is unset', async () => {
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    await makeService({}).fireWebhook({ url: 'https://x', event: 'e', body: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs the body with HMAC-SHA256 and attaches the expected headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    (global as any).fetch = fetchMock;
    const secret = 's'.repeat(40);
    await makeService({ WEBHOOK_OUTGOING_SECRET: secret }).fireWebhook({
      url: 'https://hospital.example/webhook',
      event: 'report.signed',
      body: { reportId: 'r-1' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hospital.example/webhook');
    expect(init.headers['X-Telerady-Event']).toBe('report.signed');
    const sig = init.headers['X-Telerady-Signature'] as string;
    expect(sig).toMatch(/^sha256=/);
    const expected = createHmac('sha256', secret).update(init.body as string).digest('hex');
    expect(sig).toBe(`sha256=${expected}`);
  });

  it('retries three times on non-2xx then gives up', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    (global as any).fetch = fetchMock;
    await makeService({ WEBHOOK_OUTGOING_SECRET: 's'.repeat(40) }).fireWebhook({
      url: 'https://x',
      event: 'e',
      body: {},
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns after the first 2xx response', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    (global as any).fetch = fetchMock;
    await makeService({ WEBHOOK_OUTGOING_SECRET: 's'.repeat(40) }).fireWebhook({
      url: 'https://x',
      event: 'e',
      body: {},
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
