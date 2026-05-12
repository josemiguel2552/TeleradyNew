import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface TsaStamp {
  provider: string;
  hashAlgorithm: 'sha256';
  hash: string;
  ts: string;
  /** Opaque token returned by the TSA. */
  token: string;
}

/**
 * Mock RFC 3161-style timestamp authority.
 *
 * Sprint 8 swaps this for a real qualified eIDAS provider (e.g. ANF AC,
 * SafeStamper, Camerfirma TSA). The interface — `stamp(hash) => token` —
 * stays stable so we don't have to touch the signature flow.
 *
 * The returned token here is `sha256(provider || hash || serverTs)` — *not*
 * a cryptographic guarantee, just deterministic enough for tests.
 */
@Injectable()
export class TsaService {
  private readonly provider = 'mock:internal';

  async stamp(payload: Buffer | string): Promise<TsaStamp> {
    const bytes = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
    const hash = createHash('sha256').update(bytes).digest('hex');
    const ts = new Date().toISOString();
    const token = createHash('sha256')
      .update(`${this.provider}|${hash}|${ts}`)
      .digest('hex');
    return { provider: this.provider, hashAlgorithm: 'sha256', hash, ts, token };
  }
}
