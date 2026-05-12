import { Injectable } from '@nestjs/common';
import { AesGcmService } from './aes-gcm.service';
import { PseudonymService } from './pseudonym.service';

/**
 * Convenience wrapper that turns plaintext field values into a packed
 * ciphertext string ready to be stored in a TEXT column, and back. Optional
 * AAD (Additional Authenticated Data) lets the caller bind a record to its
 * tenant or table so a ciphertext copy-pasted into another row will fail to
 * decrypt.
 *
 * For values that must remain searchable without re-identification, use
 * `lookupHash` to derive a deterministic HMAC-SHA256 (same input → same hex).
 * Pair the encrypted column with a `*_hash` column for `WHERE` clauses.
 */
@Injectable()
export class ColumnEncryptionService {
  constructor(
    private readonly aes: AesGcmService,
    private readonly pseudonym: PseudonymService,
  ) {}

  encrypt(value: string, aad?: string): string {
    return this.aes.pack(this.aes.encrypt(value, aad));
  }

  decrypt(packed: string, aad?: string): string {
    return this.aes.decryptString(this.aes.unpack(packed), aad);
  }

  encryptIfPresent(value: string | null | undefined, aad?: string): string | null {
    if (value === null || value === undefined || value === '') return null;
    return this.encrypt(value, aad);
  }

  decryptIfPresent(packed: string | null | undefined, aad?: string): string | null {
    if (packed === null || packed === undefined || packed === '') return null;
    return this.decrypt(packed, aad);
  }

  lookupHash(value: string): string {
    return this.pseudonym.hash(value);
  }
}
