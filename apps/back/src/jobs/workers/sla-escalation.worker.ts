import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import { auditLogInTelerady } from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import type { SlaJobPayload } from '../jobs.service';

@Processor('sla-escalation')
export class SlaEscalationWorker extends WorkerHost {
  private readonly logger = new Logger(SlaEscalationWorker.name);

  constructor(private readonly audit: AuditLogService) {
    super();
  }

  async process(job: Job<SlaJobPayload>): Promise<{ escalated: number }> {
    const minutes = job.data?.minutes ?? 24 * 60;
    const rows = await db.execute<{ id: string; hospital_id: string | null }>(sql`
      SELECT rs.id, rs.hospital_id
      FROM telerady.report_study rs
      LEFT JOIN telerady.report r ON r.report_study_id = rs.id
      WHERE (r.signed_at IS NULL OR r.state IN ('draft','finalized'))
        AND rs.study_created_time IS NOT NULL
        AND (now() - rs.study_created_time) > make_interval(mins => ${minutes})
        AND NOT EXISTS (
          SELECT 1 FROM telerady.audit_log al
          WHERE al.target_id = rs.id::text
            AND al.action = 'workflow.sla_breach_escalated'
            AND al.ts > now() - interval '24 hours'
        )
    `);
    let escalated = 0;
    for (const row of rows.rows) {
      await this.audit.append({
        actorId: job.data?.actorId ?? null,
        actorRole: 'system',
        hospitalId: row.hospital_id,
        action: 'workflow.sla_breach_escalated',
        targetKind: 'ReportStudy',
        targetId: row.id,
        payload: { thresholdMinutes: minutes, source: 'sla-escalation-worker' },
      });
      escalated += 1;
    }
    if (escalated > 0) this.logger.log(`escalated ${escalated} breaches`);
    void auditLogInTelerady;
    return { escalated };
  }
}
