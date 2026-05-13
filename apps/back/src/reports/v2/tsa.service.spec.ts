import { createHash } from 'node:crypto';
import { TsaService } from './tsa.service';

describe('TsaService (mock RFC 3161 stamper)', () => {
  let service: TsaService;

  beforeEach(() => {
    service = new TsaService();
  });

  it('hashes string payloads as UTF-8 sha256', async () => {
    const stamp = await service.stamp('hello');
    expect(stamp.hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
    expect(stamp.hashAlgorithm).toBe('sha256');
    expect(stamp.provider).toBe('mock:internal');
  });

  it('hashes Buffer payloads bit-identically to the same string', async () => {
    const fromString = await service.stamp('telerady');
    const fromBuffer = await service.stamp(Buffer.from('telerady', 'utf8'));
    expect(fromBuffer.hash).toBe(fromString.hash);
  });

  it('returns an ISO 8601 timestamp', async () => {
    const stamp = await service.stamp('payload');
    expect(stamp.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Number.isNaN(Date.parse(stamp.ts))).toBe(false);
  });

  it('binds the token to provider|hash|ts (sha256 of the triple)', async () => {
    const stamp = await service.stamp('payload');
    const expected = createHash('sha256')
      .update(`mock:internal|${stamp.hash}|${stamp.ts}`)
      .digest('hex');
    expect(stamp.token).toBe(expected);
  });

  it('keeps the hash stable across calls but rotates the token via ts', async () => {
    const first = await service.stamp('same payload');
    // jest fake timers are not engaged here on purpose — Date.now() ticks at
    // wall-clock resolution. Force a perceptible gap so the token diverges.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await service.stamp('same payload');
    expect(second.hash).toBe(first.hash);
    expect(second.token).not.toBe(first.token);
  });
});
