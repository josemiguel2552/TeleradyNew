import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import {
  assignmentRuleInTelerady,
  reportInTelerady,
  reportStudyInTelerady,
} from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { TenantScope } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import type { AssignmentRuleDto, AssignmentRuleResponseDto } from './dto/assignment-rule.dto';
import type { ReviewReportDto } from './dto/review-report.dto';

@Injectable()
export class WorkflowAdminService {
  constructor(private readonly audit: AuditLogService) {}

  async listRules(user: AuthenticatedUser): Promise<AssignmentRuleResponseDto[]> {
    const scope = TenantScope.for(user);
    const tenant = scope.whereHospital(assignmentRuleInTelerady.hospitalId);
    const rows = await db
      .select()
      .from(assignmentRuleInTelerady)
      .where(tenant)
      .orderBy(assignmentRuleInTelerady.priority);
    return rows.map((r) => this.toDto(r));
  }

  async createRule(user: AuthenticatedUser, dto: AssignmentRuleDto): Promise<AssignmentRuleResponseDto> {
    const scope = TenantScope.for(user);
    if (dto.hospitalId) scope.assertCanAct(dto.hospitalId);
    else if (!scope.isPrivileged) {
      throw new ForbiddenException('Only privileged actors can create global rules');
    }
    const [row] = await db
      .insert(assignmentRuleInTelerady)
      .values({
        hospitalId: dto.hospitalId ?? null,
        modality: dto.modality ?? null,
        subspecialtyId: dto.subspecialtyId ?? null,
        targetProfessionalId: dto.targetProfessionalId,
        priority: dto.priority,
        requiresReview: dto.requiresReview,
        active: dto.active,
      })
      .returning();
    await this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      hospitalId: dto.hospitalId ?? null,
      action: 'workflow.rule_created',
      targetKind: 'AssignmentRule',
      targetId: row.id,
      payload: { ...dto },
    });
    return this.toDto(row);
  }

  async deleteRule(user: AuthenticatedUser, id: string): Promise<void> {
    const scope = TenantScope.for(user);
    const rows = await db
      .select()
      .from(assignmentRuleInTelerady)
      .where(eq(assignmentRuleInTelerady.id, id))
      .limit(1);
    const rule = rows[0];
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.hospitalId) scope.assertCanAct(rule.hospitalId);
    else if (!scope.isPrivileged) throw new ForbiddenException('Cannot delete a global rule');
    await db.delete(assignmentRuleInTelerady).where(eq(assignmentRuleInTelerady.id, id));
    await this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      hospitalId: rule.hospitalId,
      action: 'workflow.rule_deleted',
      targetKind: 'AssignmentRule',
      targetId: id,
      payload: {},
    });
  }

  async review(
    user: AuthenticatedUser,
    reportStudyId: string,
    dto: ReviewReportDto,
  ) {
    if (!user.professionalId) {
      throw new ForbiddenException('Only a professional can review a report');
    }
    const scope = TenantScope.for(user);
    const studyRows = await db
      .select({
        id: reportStudyInTelerady.id,
        hospitalId: reportStudyInTelerady.hospitalId,
      })
      .from(reportStudyInTelerady)
      .where(eq(reportStudyInTelerady.id, reportStudyId))
      .limit(1);
    const study = studyRows[0];
    if (!study) throw new NotFoundException('Study not found');
    if (study.hospitalId && !scope.isPrivileged) scope.assertCanAct(study.hospitalId);

    const reportRows = await db
      .select()
      .from(reportInTelerady)
      .where(eq(reportInTelerady.reportStudyId, reportStudyId))
      .limit(1);
    const report = reportRows[0];
    if (!report) throw new NotFoundException('Report not found');
    if (!report.requiresReview) {
      throw new BadRequestException('Report does not require review');
    }
    if (report.state !== 'signed' && report.state !== 'finalized') {
      throw new BadRequestException(
        `Report must be finalized or signed to be reviewed (state=${report.state})`,
      );
    }
    if (report.professionalId === user.professionalId) {
      throw new ForbiddenException('Reviewer must be different from the primary author');
    }

    const [updated] = await db
      .update(reportInTelerady)
      .set({
        reviewerProfessionalId: user.professionalId,
        reviewedAt: sql`now()`,
        reviewApproved: dto.approved,
        // A rejected review knocks the report back to draft so the primary
        // can edit again; an approval leaves the state untouched.
        state: dto.approved ? report.state : 'draft',
        version: dto.approved ? report.version : report.version + 1,
        updatedAt: sql`now()`,
      })
      .where(eq(reportInTelerady.id, report.id))
      .returning();

    await this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      hospitalId: study.hospitalId,
      action: dto.approved ? 'report.review_approved' : 'report.review_rejected',
      targetKind: 'Report',
      targetId: report.id,
      payload: {
        reviewerProfessionalId: user.professionalId,
        comments: dto.comments ?? null,
      },
    });
    return {
      id: updated.id,
      state: updated.state,
      reviewApproved: updated.reviewApproved,
      reviewerProfessionalId: updated.reviewerProfessionalId,
      reviewedAt: updated.reviewedAt,
    };
  }

  /**
   * Sweep that escalates studies whose creation is older than the SLA and
   * are still pending. Idempotent: the action is recorded once per
   * (study, sweep run) pair via the audit log; the audit is the source
   * of truth for whether the operator already saw the breach.
   */
  async escalateBreaches(user: AuthenticatedUser, minutes: number): Promise<{ escalated: number }> {
    if (!TenantScope.for(user).isPrivileged) {
      throw new ForbiddenException('Only admin or coordinator can escalate');
    }
    const rows = await db.execute<{ id: string; hospital_id: string | null }>(sql`
      SELECT rs.id, rs.hospital_id
      FROM telerady.report_study rs
      LEFT JOIN telerady.report r ON r.report_study_id = rs.id
      WHERE (r.signed_at IS NULL OR r.state IN ('draft','finalized'))
        AND rs.study_created_time IS NOT NULL
        AND (now() - rs.study_created_time) > make_interval(mins => ${minutes})
    `);
    let escalated = 0;
    for (const row of rows.rows) {
      await this.audit.append({
        actorId: user.id,
        actorRole: user.roles[0] ?? null,
        hospitalId: row.hospital_id,
        action: 'workflow.sla_breach_escalated',
        targetKind: 'ReportStudy',
        targetId: row.id,
        payload: { thresholdMinutes: minutes },
      });
      escalated += 1;
    }
    return { escalated };
  }

  private toDto(row: typeof assignmentRuleInTelerady.$inferSelect): AssignmentRuleResponseDto {
    return {
      id: row.id,
      hospitalId: row.hospitalId,
      modality: row.modality,
      subspecialtyId: row.subspecialtyId,
      targetProfessionalId: row.targetProfessionalId ?? '',
      priority: row.priority,
      requiresReview: row.requiresReview,
      active: row.active,
      createdAt: row.createdAt,
    };
  }
}

void and; // pulled in by the conditions builder