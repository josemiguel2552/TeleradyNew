import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql, SQL } from 'drizzle-orm';
import { db as defaultDb, DBOrTx } from '../../database/drizzle';
import { reportStudyInTelerady } from '../../database/schema';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { TenantScope } from '../../common/tenant/tenant-scope';
import { WorklistEntryDto, WorklistQueryDto } from './dto/worklist.dto';

export interface WorklistResult {
  entries: WorklistEntryDto[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class WorklistRepository {
  constructor(private readonly enc: ColumnEncryptionService) {}

  async list(
    scope: TenantScope,
    query: WorklistQueryDto,
    db: DBOrTx = defaultDb,
  ): Promise<WorklistResult> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const conditions = this.buildConditions(scope, query);
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportStudyInTelerady)
      .where(whereClause);
    const total = totalRows[0]?.count ?? 0;

    const rows = await db
      .select({
        id: reportStudyInTelerady.id,
        studyIuid: reportStudyInTelerady.studyIuid,
        studyDesc: reportStudyInTelerady.studyDesc,
        studyCreatedTime: reportStudyInTelerady.studyCreatedTime,
        modalities: reportStudyInTelerady.modalities,
        institution: reportStudyInTelerady.institution,
        hospitalId: reportStudyInTelerady.hospitalId,
        reportStateId: reportStudyInTelerady.reportStateId,
        professionalId: reportStudyInTelerady.professionalId,
        patNameEnc: reportStudyInTelerady.patNameEnc,
        patBirthdateEnc: reportStudyInTelerady.patBirthdateEnc,
        patIdHash: reportStudyInTelerady.patIdHash,
      })
      .from(reportStudyInTelerady)
      .where(whereClause)
      .orderBy(desc(reportStudyInTelerady.studyCreatedTime), desc(reportStudyInTelerady.id))
      .limit(limit)
      .offset(offset);

    return {
      entries: rows.map((row) => this.toEntry(row)),
      total,
      limit,
      offset,
    };
  }

  async findById(
    scope: TenantScope,
    id: string,
    db: DBOrTx = defaultDb,
  ): Promise<WorklistEntryDto | null> {
    const tenant = scope.whereHospital(reportStudyInTelerady.hospitalId);
    const conditions: SQL[] = [eq(reportStudyInTelerady.id, id)];
    if (tenant) conditions.push(tenant);
    const rows = await db
      .select()
      .from(reportStudyInTelerady)
      .where(and(...conditions))
      .limit(1);
    if (!rows.length) return null;
    return this.toEntry(rows[0]);
  }

  private buildConditions(scope: TenantScope, query: WorklistQueryDto): SQL[] {
    const conditions: SQL[] = [];
    const tenant = scope.whereHospital(reportStudyInTelerady.hospitalId);
    if (tenant) conditions.push(tenant);

    if (query.hospitalId) {
      scope.assertCanAct(query.hospitalId);
      conditions.push(eq(reportStudyInTelerady.hospitalId, query.hospitalId));
    }
    if (query.stateId !== undefined) {
      conditions.push(eq(reportStudyInTelerady.reportStateId, query.stateId));
    }
    if (query.modality) {
      conditions.push(sql`${query.modality} = ANY (${reportStudyInTelerady.modalities})`);
    }
    if (query.studyDateFrom) {
      conditions.push(
        gte(
          reportStudyInTelerady.studyCreatedTime,
          dicomDateToIso(query.studyDateFrom, '00', '00', '00'),
        ),
      );
    }
    if (query.studyDateTo) {
      conditions.push(
        lte(
          reportStudyInTelerady.studyCreatedTime,
          dicomDateToIso(query.studyDateTo, '23', '59', '59'),
        ),
      );
    }
    return conditions;
  }

  private toEntry(row: typeof reportStudyInTelerady.$inferSelect | Record<string, unknown>): WorklistEntryDto {
    const r = row as Record<string, any>;
    const aad = `report_study:${r.professionalId}`;
    return {
      id: r.id,
      studyInstanceUid: r.studyIuid,
      studyDescription: r.studyDesc ?? null,
      studyCreatedAt: r.studyCreatedTime ?? null,
      modalities: r.modalities ?? [],
      institution: r.institution ?? null,
      hospitalId: r.hospitalId ?? null,
      reportStateId: r.reportStateId,
      patName: this.enc.decryptIfPresent(r.patNameEnc, aad),
      patBirthdate: this.enc.decryptIfPresent(r.patBirthdateEnc, aad),
      patIdHash: r.patIdHash ?? null,
    };
  }
}

function dicomDateToIso(date: string, hh: string, mm: string, ss: string): string {
  // Accept either 'YYYYMMDD' or 'YYYY-MM-DD'.
  const normalised = date.replace(/-/g, '');
  const y = normalised.slice(0, 4);
  const m = normalised.slice(4, 6) || '01';
  const d = normalised.slice(6, 8) || '01';
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
}
