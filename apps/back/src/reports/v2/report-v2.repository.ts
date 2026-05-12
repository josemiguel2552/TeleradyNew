import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DBOrTx, db as defaultDb } from '../../database/drizzle';
import {
  hospitalInTelerady,
  reportInTelerady,
  reportStudyInTelerady,
  type ReportState,
} from '../../database/schema';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { TenantScope } from '../../common/tenant/tenant-scope';

export interface ReportRow {
  id: string;
  reportStudyId: string;
  hospitalId: string | null;
  professionalId: string;
  version: number;
  state: ReportState;
  contents: unknown | null;
  signatureData: unknown | null;
  pdfBucket: string | null;
  pdfKey: string | null;
  signedAt: string | null;
  sentAt: string | null;
}

export interface ReportStudyContext {
  reportStudyId: string;
  hospitalId: string | null;
  professionalId: string;
}

@Injectable()
export class ReportV2Repository {
  constructor(private readonly enc: ColumnEncryptionService) {}

  async findStudyById(
    scope: TenantScope,
    reportStudyId: string,
    db: DBOrTx = defaultDb,
  ): Promise<ReportStudyContext | null> {
    const tenant = scope.whereHospital(reportStudyInTelerady.hospitalId);
    const conditions = [eq(reportStudyInTelerady.id, reportStudyId)];
    if (tenant) conditions.push(tenant);
    const rows = await db
      .select({
        id: reportStudyInTelerady.id,
        hospitalId: reportStudyInTelerady.hospitalId,
        professionalId: reportStudyInTelerady.professionalId,
      })
      .from(reportStudyInTelerady)
      .where(and(...conditions))
      .limit(1);
    if (!rows.length) return null;
    return {
      reportStudyId: rows[0].id,
      hospitalId: rows[0].hospitalId,
      professionalId: rows[0].professionalId,
    };
  }

  async getHospitalPolicy(
    hospitalId: string,
    db: DBOrTx = defaultDb,
  ): Promise<string | null> {
    const rows = await db
      .select({ policy: hospitalInTelerady.signaturePolicy })
      .from(hospitalInTelerady)
      .where(eq(hospitalInTelerady.id, hospitalId))
      .limit(1);
    return rows[0]?.policy ?? null;
  }

  async findByStudyId(
    scope: TenantScope,
    reportStudyId: string,
    db: DBOrTx = defaultDb,
  ): Promise<ReportRow | null> {
    const tenant = scope.whereHospital(reportInTelerady.hospitalId);
    const conditions = [eq(reportInTelerady.reportStudyId, reportStudyId)];
    if (tenant) conditions.push(tenant);
    const rows = await db
      .select()
      .from(reportInTelerady)
      .where(and(...conditions))
      .limit(1);
    if (!rows.length) return null;
    return this.decryptRow(rows[0]);
  }

  async upsertDraft(
    studyCtx: ReportStudyContext,
    contents: unknown,
    db: DBOrTx = defaultDb,
  ): Promise<ReportRow> {
    const aad = `report:${studyCtx.reportStudyId}`;
    const contentsEnc = this.enc.encrypt(JSON.stringify(contents), aad);

    const existing = await db
      .select()
      .from(reportInTelerady)
      .where(eq(reportInTelerady.reportStudyId, studyCtx.reportStudyId))
      .limit(1);

    if (existing.length) {
      const [row] = await db
        .update(reportInTelerady)
        .set({
          contentsEnc,
          state: existing[0].state === 'draft' ? 'draft' : existing[0].state,
          version: existing[0].version + 1,
          updatedAt: sql`now()`,
        })
        .where(eq(reportInTelerady.id, existing[0].id))
        .returning();
      return this.decryptRow(row);
    }

    const [row] = await db
      .insert(reportInTelerady)
      .values({
        reportStudyId: studyCtx.reportStudyId,
        hospitalId: studyCtx.hospitalId,
        professionalId: studyCtx.professionalId,
        contentsEnc,
        state: 'draft',
        version: 1,
      })
      .returning();
    return this.decryptRow(row);
  }

  async finalize(reportId: string, db: DBOrTx = defaultDb): Promise<ReportRow> {
    const [row] = await db
      .update(reportInTelerady)
      .set({ state: 'finalized', updatedAt: sql`now()` })
      .where(eq(reportInTelerady.id, reportId))
      .returning();
    return this.decryptRow(row);
  }

  async sign(
    reportId: string,
    signatureData: Record<string, unknown>,
    pdf: { bucket: string; key: string },
    db: DBOrTx = defaultDb,
  ): Promise<ReportRow> {
    const [row] = await db
      .update(reportInTelerady)
      .set({
        state: 'signed',
        signatureData,
        pdfBucket: pdf.bucket,
        pdfKey: pdf.key,
        signedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(reportInTelerady.id, reportId))
      .returning();
    return this.decryptRow(row);
  }

  async markSent(reportId: string, db: DBOrTx = defaultDb): Promise<ReportRow> {
    const [row] = await db
      .update(reportInTelerady)
      .set({ state: 'sent', sentAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(reportInTelerady.id, reportId))
      .returning();
    return this.decryptRow(row);
  }

  private decryptRow(row: typeof reportInTelerady.$inferSelect): ReportRow {
    const aad = `report:${row.reportStudyId}`;
    let contents: unknown = null;
    if (row.contentsEnc) {
      try {
        contents = JSON.parse(this.enc.decrypt(row.contentsEnc, aad));
      } catch {
        contents = null;
      }
    }
    return {
      id: row.id,
      reportStudyId: row.reportStudyId,
      hospitalId: row.hospitalId ?? null,
      professionalId: row.professionalId,
      version: row.version,
      state: row.state as ReportState,
      contents,
      signatureData: (row.signatureData as unknown) ?? null,
      pdfBucket: row.pdfBucket,
      pdfKey: row.pdfKey,
      signedAt: row.signedAt,
      sentAt: row.sentAt,
    };
  }
}
