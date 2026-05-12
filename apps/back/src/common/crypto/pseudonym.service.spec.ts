import { ConfigService } from '@nestjs/config';
import { PseudonymService } from './pseudonym.service';

function makeService(pepperHex = Buffer.alloc(32, 9).toString('hex')): PseudonymService {
  const config = { getOrThrow: () => pepperHex } as unknown as ConfigService;
  return new PseudonymService(config);
}

describe('PseudonymService', () => {
  it('is deterministic for the same input', () => {
    const svc = makeService();
    expect(svc.hash('12345678A')).toBe(svc.hash('12345678A'));
  });

  it('produces different hashes for different peppers', () => {
    const a = makeService(Buffer.alloc(32, 1).toString('hex'));
    const b = makeService(Buffer.alloc(32, 2).toString('hex'));
    expect(a.hash('same')).not.toBe(b.hash('same'));
  });

  it('rejects short pepper', () => {
    expect(() => makeService('ab')).toThrow(/PSEUDONYM_PEPPER/);
  });
});
