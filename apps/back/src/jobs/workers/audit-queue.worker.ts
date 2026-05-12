import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import { auditLogInTelerady } from '../../database/schema';
import { HashChainService } from '../../common/crypto/hash-chain.service';

@Processor('audit-verify')
export class AuditQueueWorker extends WorkerHost {
  private readonly logger = new Logger(AuditQueueWorker.name);
  private readonly seed: string | null;

  constructor(private readonly chain: HashChainService, config: ConfigService) {
    super();
    this.seed = config.get<string>('AUDIT_HASH_CHAIN_SEED') ?? null;
  }

  async process(_job: Job): Promise<{ ok: boolean; checkedRows: number; firstInvalidId: string | null }> {
    const rows = await db
      .select()
      .from(auditLogInTelerady)
      .orderBy(sql`${auditLogInTelerady.ts} ASC, ${auditLogInTelerady.id} ASC`);

    let prev: string | null = this.seed;
    let checked = 0;
    for (const row of rows) {
      const { id, prevHash, hash, ts, ...rest } = row as Record<string, unknown> & {
        id: string;
        prevHash: string | null;
        hash: string;
      };
      void ts;
      if (prevHash !== prev) {
        this.logger.error(`AUDIT TAMPERED at row ${id}: prevHash mismatch`);
        return { ok: false, checkedRows: checked, firstInvalidId: id };
      }
      const expected = this.chain.next(prev, rest);
      if (expected !== hash) {
        this.logger.error(`AUDIT TAMPERED at row ${id}: hash mismatch`);
        return { ok: false, checkedRows: checked, firstInvalidId: id };
      }
      prev = hash;
      checked += 1;
    }
    return { ok: true, checkedRows: checked, firstInvalidId: null };
  }
}
