import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

/**
 * Computes the next link of an append-only hash chain used by the audit log.
 *
 *   hash = sha256(prevHash || canonical(payload))
 *
 * `canonical(payload)` is the JSON of the payload with keys sorted recursively
 * so two equivalent objects always produce the same hash.
 */
@Injectable()
export class HashChainService {
  next(prevHash: string | null, payload: unknown): string {
    const canonical = this.canonicalize(payload);
    const buf = Buffer.concat([
      Buffer.from(prevHash ?? '', 'utf8'),
      Buffer.from(canonical, 'utf8'),
    ]);
    return createHash('sha256').update(buf).digest('hex');
  }

  verify(prevHash: string | null, payload: unknown, expected: string): boolean {
    return this.next(prevHash, payload) === expected;
  }

  private canonicalize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.canonicalize(v)).join(',')}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${this.canonicalize(v)}`).join(',')}}`;
  }
}
