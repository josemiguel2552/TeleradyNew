import { ConfigService } from '@nestjs/config';
import { AesGcmService } from './aes-gcm.service';

function makeService(): AesGcmService {
  const key = Buffer.alloc(32, 7).toString('hex');
  const config = { getOrThrow: () => key } as unknown as ConfigService;
  return new AesGcmService(config);
}

describe('AesGcmService', () => {
  it('round-trips a UTF-8 string', () => {
    const svc = makeService();
    const payload = svc.encrypt('María García — IBAN ES12...');
    expect(svc.decryptString(payload)).toBe('María García — IBAN ES12...');
  });

  it('generates a fresh IV on every encrypt', () => {
    const svc = makeService();
    const a = svc.encrypt('same input');
    const b = svc.encrypt('same input');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects tampered ciphertext', () => {
    const svc = makeService();
    const payload = svc.encrypt('top secret');
    const tampered = {
      ...payload,
      ciphertext: Buffer.from(payload.ciphertext, 'base64')
        .map((b, i) => (i === 0 ? b ^ 1 : b))
        .toString('base64'),
    };
    expect(() => svc.decrypt(tampered as never)).toThrow();
  });

  it('honours AAD: wrong AAD fails decrypt', () => {
    const svc = makeService();
    const payload = svc.encrypt('bind me to hospital-A', 'hospital-A');
    expect(() => svc.decrypt(payload, 'hospital-B')).toThrow();
    expect(svc.decryptString(payload, 'hospital-A')).toBe('bind me to hospital-A');
  });

  it('packs and unpacks to a string envelope', () => {
    const svc = makeService();
    const packed = svc.pack(svc.encrypt('round trip'));
    const decoded = svc.unpack(packed);
    expect(svc.decryptString(decoded)).toBe('round trip');
  });
});
