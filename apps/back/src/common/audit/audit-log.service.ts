import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { desc, sql } from 'drizzle-orm';
import { DBOrTx, db as defaultDb } from '../../database/drizzle';
import { auditLogInTelerady } from '../../database/schema';
import { HashChainService } from '../crypto/hash-chain.service';

export interface AuditLogEntry {
  actorId?: string | null;
  actorRole?: string | null;
  hospitalId?: string | null;
  action: string;
  targetKind: string;
  targetId?: string | null;
  payload: Record<string, unknown>;
  requestIp?: string | null;
  requestUa?: string | null;
}

/**
 * Append-only writer for the audit_log table. Reads the latest hash within a
 * SERIALIZABLE transaction so that concurrent writers cannot interleave and
 * break the chain.
 *
 * The seed (`AUDIT_HASH_CHAIN_SEED` env var) is used as the prevHash for the
 * very first record. After that, each record's hash becomes the next prevHash.
 */
@Injectable()
export class AuditLogService {
  private readonly seed: string | null;

  constructor(
    private readonly chain: HashChainService,
    config: ConfigService,
  ) {
    this.seed = config.get<string>('AUDIT_HASH_CHAIN_SEED') ?? null;
  }

  async append(entry: AuditLogEntry, tx?: DBOrTx): Promise<{ id: string; hash: string }> {
    const exec = async (txx: DBOrTx): Promise<{ id: string; hash: string }> => {
      const last = await txx
        .select({ hash: auditLogInTelerady.hash })
        .from(auditLogInTelerady)
        .orderBy(desc(auditLogInTelerady.ts), desc(auditLogInTelerady.id))
        .limit(1)
        .for('update');

      const prevHash = last.length ? last[0].hash : this.seed;
      const record = {
        actorId: entry.actorId ?? null,
        actorRole: entry.actorRole ?? null,
        hospitalId: entry.hospitalId ?? null,
        action: entry.action,
        targetKind: entry.targetKind,
        targetId: entry.targetId ?? null,
        payload: entry.payload,
        requestIp: entry.requestIp ?? null,
        requestUa: entry.requestUa ?? null,
      };
      const hash = this.chain.next(prevHash, record);

      const inserted = await txx
        .insert(auditLogInTelerady)
        .values({ ...record, prevHash, hash })
        .returning({ id: auditLogInTelerady.id });

      return { id: inserted[0].id, hash };
    };

    if (tx) return exec(tx);
    return defaultDb.transaction(exec, { isolationLevel: 'serializable' });
  }

  async verify(): Promise<{ ok: true } | { ok: false; firstInvalidId: string }> {
    const rows = await defaultDb
      .select({
        id: auditLogInTelerady.id,
        prevHash: auditLogInTelerady.prevHash,
        hash: auditLogInTelerady.hash,
        actorId: auditLogInTelerady.actorId,
        actorRole: auditLogInTelerady.actorRole,
        hospitalId: auditLogInTelerady.hospitalId,
        action: auditLogInTelerady.action,
        targetKind: auditLogInTelerady.targetKind,
        targetId: auditLogInTelerady.targetId,
        payload: auditLogInTelerady.payload,
        requestIp: auditLogInTelerady.requestIp,
        requestUa: auditLogInTelerady.requestUa,
      })
      .from(auditLogInTelerady)
      .orderBy(sql`${auditLogInTelerady.ts} ASC, ${auditLogInTelerady.id} ASC`);

    let prev: string | null = this.seed;
    for (const row of rows) {
      const { id, prevHash, hash, ...rest } = row;
      if (prevHash !== prev) return { ok: false, firstInvalidId: id };
      const expected = this.chain.next(prev, rest);
      if (expected !== hash) return { ok: false, firstInvalidId: id };
      prev = hash;
    }
    return { ok: true };
  }
}
