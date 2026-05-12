import { ConfigService } from '@nestjs/config';
import { AesGcmService } from './aes-gcm.service';
import { ColumnEncryptionService } from './column-encryption.service';
import { PseudonymService } from './pseudonym.service';

function makeService(): ColumnEncryptionService {
  const masterKey = Buffer.alloc(32, 5).toString('hex');
  const pepper = Buffer.alloc(32, 9).toString('hex');
  const config = {
    getOrThrow: (key: string) => (key === 'ENCRYPTION_MASTER_KEY' ? masterKey : pepper),
  } as unknown as ConfigService;
  const pepperConfig = { getOrThrow: () => pepper } as unknown as ConfigService;
  return new ColumnEncryptionService(new AesGcmService(config), new PseudonymService(pepperConfig));
}

describe('ColumnEncryptionService', () => {
  it('round-trips a UTF-8 value', () => {
    const svc = makeService();
    const packed = svc.encrypt('María');
    expect(svc.decrypt(packed)).toBe('María');
  });

  it('returns null for empty inputs (encryptIfPresent)', () => {
    const svc = makeService();
    expect(svc.encryptIfPresent('')).toBeNull();
    expect(svc.encryptIfPresent(null)).toBeNull();
    expect(svc.encryptIfPresent(undefined)).toBeNull();
  });

  it('AAD-bound ciphertext cannot be decrypted with a different AAD', () => {
    const svc = makeService();
    const packed = svc.encrypt('IBAN ES12...', 'hospital-A');
    expect(() => svc.decrypt(packed, 'hospital-B')).toThrow();
    expect(svc.decrypt(packed, 'hospital-A')).toBe('IBAN ES12...');
  });

  it('lookupHash is deterministic', () => {
    const svc = makeService();
    expect(svc.lookupHash('PAT-001')).toBe(svc.lookupHash('PAT-001'));
    expect(svc.lookupHash('PAT-001')).not.toBe(svc.lookupHash('PAT-002'));
  });
});
