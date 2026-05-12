import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

/**
 * Deterministic pseudonymization of patient identifiers.
 *
 * Uses HMAC-SHA256 with a server-side pepper that is *not* derived from the
 * encryption master key, so that even if the BD dump leaks, the pseudonyms
 * cannot be reversed without the pepper.
 *
 * Same input always produces the same output: enables joining events without
 * re-identifying.
 */
@Injectable()
export class PseudonymService {
  private readonly pepper: Buffer;

  constructor(config: ConfigService) {
    const hex = config.getOrThrow<string>('PSEUDONYM_PEPPER');
    const pepper = Buffer.from(hex, 'hex');
    if (pepper.length < 32) {
      throw new Error('PSEUDONYM_PEPPER must be at least 32 bytes (64 hex chars)');
    }
    this.pepper = pepper;
  }

  hash(value: string): string {
    return createHmac('sha256', this.pepper).update(value, 'utf8').digest('hex');
  }
}
