import { HashChainService } from './hash-chain.service';

describe('HashChainService', () => {
  const svc = new HashChainService();

  it('canonicalises object key order', () => {
    const a = svc.next(null, { a: 1, b: 2 });
    const b = svc.next(null, { b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it('chains: changing prevHash changes the result', () => {
    const a = svc.next('abc', { x: 1 });
    const b = svc.next('def', { x: 1 });
    expect(a).not.toBe(b);
  });

  it('verify accepts the matching hash and rejects tampered payloads', () => {
    const hash = svc.next(null, { action: 'login', actor: 'u1' });
    expect(svc.verify(null, { action: 'login', actor: 'u1' }, hash)).toBe(true);
    expect(svc.verify(null, { action: 'login', actor: 'u2' }, hash)).toBe(false);
  });
});
