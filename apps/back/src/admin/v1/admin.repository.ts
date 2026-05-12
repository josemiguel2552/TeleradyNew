import { Injectable } from '@nestjs/common';
import { and, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { db as defaultDb, DBOrTx } from '../../database/drizzle';
import { reportInTelerady, reportStudyInTelerady } from '../../database/schema';
import { TenantScope } from '../../common/tenant/tenant-scope';
import type { SlaCountByStateDto, SlaDashboardDto } from './dto/sla.dto';

const SLA_MINUTES = 24 * 60;

@Injectable()
export class AdminRepository {
  async reassignStudy(
    tx: DBOrTx,
    reportStudyId: string,
    professionalId: string,
  ): Promise<void> {
    await tx
      .update(reportStudyInTelerady)
      .set({ professionalId })
      .where(eq(reportStudyInTelerady.id, reportStudyId))
      .execute();
    // Keep any in-flight report draft linked to the new assignee.
    await tx
      .update(reportInTelerady)
      .set({ professionalId, updatedAt: sql`now()` })
      .where(eq(reportInTelerady.reportStudyId, reportStudyId))
      .execute();
  }

  async slaDashboard(
    scope: TenantScope,
    hospitalId: string | undefined,
    db: DBOrTx = defaultDb,
  ): Promise<SlaDashboardDto> {
    const baseConditions: SQL[] = [];
    const tenant = scope.whereHospital(reportStudyInTelerady.hospitalId);
    if (tenant) baseConditions.push(tenant);
    if (hospitalId) {
      scope.assertCanAct(hospitalId);
      baseConditions.push(eq(reportStudyInTelerady.hospitalId, hospitalId));
    }
    const baseWhere = baseConditions.length ? and(...baseConditions) : undefined;

    const counts = await this.countsByState(db, baseWhere);
    const avgs = await this.averages(db, baseWhere);
    const overSla = await this.overSla(db, baseWhere, SLA_MINUTES);

    return {
      counts,
      avgMinutesToSign: avgs.avgMinutesToSign,
      avgMinutesSignToSent: avgs.avgMinutesSignToSent,
      pendingCount: counts.draft + counts.finalized + counts.unreported,
      overSlaCount: overSla,
      slaMinutes: SLA_MINUTES,
    };
  }

  private async countsByState(db: DBOrTx, where: SQL | undefined): Promise<SlaCountByStateDto> {
    // We count using a LEFT JOIN so studies without a report row are
    // bucketed as "unreported".
    const rows = await db.execute<{ state: string | null; count: string }>(sql`
      SELECT coalesce(r.state, 'unreported') AS state, count(*)::text AS count
      FROM telerady.report_study rs
      LEFT JOIN telerady.report r ON r.report_study_id = rs.id
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY 1
    `);
    const out: SlaCountByStateDto = {
      draft: 0,
      finalized: 0,
      signed: 0,
      sent: 0,
      unreported: 0,
    };
    for (const row of rows.rows) {
      const key = row.state as keyof SlaCountByStateDto | null;
      if (key && key in out) out[key] = Number(row.count);
    }
    return out;
  }

  private async averages(
    db: DBOrTx,
    where: SQL | undefined,
  ): Promise<{ avgMinutesToSign: number | null; avgMinutesSignToSent: number | null }> {
    const rows = await db.execute<{
      avg_to_sign_seconds: string | null;
      avg_sign_to_sent_seconds: string | null;
    }>(sql`
      SELECT
        AVG(EXTRACT(EPOCH FROM (r.signed_at - rs.study_created_time)))::text AS avg_to_sign_seconds,
        AVG(EXTRACT(EPOCH FROM (r.sent_at - r.signed_at)))::text AS avg_sign_to_sent_seconds
      FROM telerady.report_study rs
      JOIN telerady.report r ON r.report_study_id = rs.id
      ${where ? sql`WHERE ${where}` : sql``}
    `);
    const row = rows.rows[0];
    if (!row) return { avgMinutesToSign: null, avgMinutesSignToSent: null };
    return {
      avgMinutesToSign: row.avg_to_sign_seconds ? Number(row.avg_to_sign_seconds) / 60 : null,
      avgMinutesSignToSent: row.avg_sign_to_sent_seconds
        ? Number(row.avg_sign_to_sent_seconds) / 60
        : null,
    };
  }

  private async overSla(
    db: DBOrTx,
    where: SQL | undefined,
    minutes: number,
  ): Promise<number> {
    const rows = await db.execute<{ count: string }>(sql`
      SELECT count(*)::text AS count
      FROM telerady.report_study rs
      LEFT JOIN telerady.report r ON r.report_study_id = rs.id
      WHERE (r.signed_at IS NULL OR r.state IN ('draft','finalized'))
        AND rs.study_created_time IS NOT NULL
        AND (now() - rs.study_created_time) > make_interval(mins => ${minutes})
        ${where ? sql`AND ${where}` : sql``}
    `);
    return Number(rows.rows[0]?.count ?? 0);
  }

  // Mark utilities to keep imports satisfied in tests.
  static unused = { isNull, isNotNull };
}
