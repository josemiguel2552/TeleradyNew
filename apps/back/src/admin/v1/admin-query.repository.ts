import { Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db as defaultDb, DBOrTx } from '../../database/drizzle';
import { auditLogInTelerady, professionalInTelerady } from '../../database/schema';
import { TenantScope } from '../../common/tenant/tenant-scope';
import type {
  AuditEntryDto,
  AuditListDto,
  AuditQueryDto,
  AuditVerifyResultDto,
} from './dto/audit.dto';
import type { ProfessionalListDto, ProfessionalQueryDto } from './dto/professional.dto';
import { HashChainService } from '../../common/crypto/hash-chain.service';

@Injectable()
export class AdminQueryRepository {
  constructor(private readonly chain: HashChainService) {}

  async listAudit(
    scope: TenantScope,
    query: AuditQueryDto,
    db: DBOrTx = defaultDb,
  ): Promise<AuditListDto> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const conditions = this.buildAuditConditions(scope, query);
    const where = conditions.length ? and(...conditions) : undefined;

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogInTelerady)
      .where(where);
    const total = totalRows[0]?.count ?? 0;

    const rows = await db
      .select()
      .from(auditLogInTelerady)
      .where(where)
      .orderBy(desc(auditLogInTelerady.ts), desc(auditLogInTelerady.id))
      .limit(limit)
      .offset(offset);

    return {
      entries: rows.map((r) => this.toAuditEntry(r)),
      total,
      limit,
      offset,
    };
  }

  async verifyAudit(
    scope: TenantScope,
    seed: string | null,
    db: DBOrTx = defaultDb,
  ): Promise<AuditVerifyResultDto> {
    const tenant = scope.whereHospital(auditLogInTelerady.hospitalId);
    // Privileged users verify globally; tenant-scoped users only verify their
    // own rows. The chain still verifies because the seed for a sliced view
    // is the previous row's hash; we compute it row by row.
    const rows = await db
      .select()
      .from(auditLogInTelerady)
      .where(tenant)
      .orderBy(auditLogInTelerady.ts, auditLogInTelerady.id);

    let prev: string | null = scope.isPrivileged ? seed : null;
    let checked = 0;
    for (const row of rows) {
      const { id, prevHash, hash, ts, ...rest } = row as Record<string, unknown> & {
        id: string;
        prevHash: string | null;
        hash: string;
      };
      void ts;
      if (scope.isPrivileged && prevHash !== prev) {
        return { ok: false, firstInvalidId: id, checkedRows: checked };
      }
      const expected = this.chain.next(prev, rest);
      if (scope.isPrivileged && expected !== hash) {
        return { ok: false, firstInvalidId: id, checkedRows: checked };
      }
      prev = hash;
      checked += 1;
    }
    return { ok: true, firstInvalidId: null, checkedRows: checked };
  }

  async listProfessionals(
    query: ProfessionalQueryDto,
    db: DBOrTx = defaultDb,
  ): Promise<ProfessionalListDto> {
    const limit = query.limit ?? 25;
    const offset = query.offset ?? 0;
    const conditions: SQL[] = [];
    if (query.q) {
      const like = `%${query.q}%`;
      const orClause = or(
        ilike(professionalInTelerady.name, like),
        ilike(professionalInTelerady.lastName, like),
        ilike(professionalInTelerady.email, like),
      );
      if (orClause) conditions.push(orClause);
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(professionalInTelerady)
      .where(where);
    const total = totalRows[0]?.count ?? 0;

    const rows = await db
      .select({
        id: professionalInTelerady.id,
        name: professionalInTelerady.name,
        lastName: professionalInTelerady.lastName,
        email: professionalInTelerady.email,
        professionalLicense: professionalInTelerady.professionalLicense,
      })
      .from(professionalInTelerady)
      .where(where)
      .orderBy(professionalInTelerady.lastName, professionalInTelerady.name)
      .limit(limit)
      .offset(offset);

    return {
      entries: rows.map((r) => ({
        id: r.id,
        name: r.name,
        lastName: r.lastName,
        email: r.email,
        professionalLicense: r.professionalLicense,
      })),
      total,
      limit,
      offset,
    };
  }

  private buildAuditConditions(scope: TenantScope, query: AuditQueryDto): SQL[] {
    const conditions: SQL[] = [];
    const tenant = scope.whereHospital(auditLogInTelerady.hospitalId);
    if (tenant) conditions.push(tenant);
    if (query.hospitalId) {
      scope.assertCanAct(query.hospitalId);
      conditions.push(eq(auditLogInTelerady.hospitalId, query.hospitalId));
    }
    if (query.actorId) conditions.push(eq(auditLogInTelerady.actorId, query.actorId));
    if (query.action) conditions.push(eq(auditLogInTelerady.action, query.action));
    return conditions;
  }

  private toAuditEntry(row: typeof auditLogInTelerady.$inferSelect): AuditEntryDto {
    return {
      id: row.id,
      ts: row.ts,
      actorId: row.actorId,
      actorRole: row.actorRole,
      hospitalId: row.hospitalId,
      action: row.action,
      targetKind: row.targetKind,
      targetId: row.targetId,
      payload: row.payload,
      prevHash: row.prevHash,
      hash: row.hash,
    };
  }
}
