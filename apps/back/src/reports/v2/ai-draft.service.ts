import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import {
  appUserInTelerady,
  hospitalInTelerady,
  reportStudyInTelerady,
} from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { TenantScope } from '../../common/tenant/tenant-scope';
import { MetricsService } from '../../metrics/metrics.service';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { RadiogenAIClient } from '../../integrations/radiogenai/radiogenai.client';
import type { AiDraftRequestDto, AiDraftResponseDto } from './dto/ai-draft.dto';

/**
 * Orchestrates a single AI-draft call against RadiogenAI.
 *
 * Permissions (all must pass):
 *   1. The actor's hospital has `ai_drafting_allowed = true`.
 *   2. The actor is the radiologist assigned to the study.
 *   3. The actor has accepted the AI consent banner at least once
 *      (or the current call carries `acceptConsent: true`).
 *
 * Inputs sanitisation:
 *   - The findings/title strings are forwarded verbatim. No DICOM tags
 *     or `pat_*` columns ever leave the platform; the caller never has
 *     access to them at this layer anyway (RadiogenAIClient lives in
 *     /integrations and receives only the DTO fields).
 */
@Injectable()
export class AiDraftService {
  constructor(
    private readonly client: RadiogenAIClient,
    private readonly audit: AuditLogService,
    private readonly metrics: MetricsService,
  ) {}

  async generate(
    reportStudyId: string,
    dto: AiDraftRequestDto,
    user: AuthenticatedUser,
  ): Promise<AiDraftResponseDto> {
    if (!this.client.configured) {
      throw new ServiceUnavailableException('AI integration not configured');
    }
    if (!user.professionalId) {
      throw new ForbiddenException('Only a registered professional can request AI drafts');
    }
    if (dto.findings.trim().length < 10) {
      throw new ServiceUnavailableException('Findings too short to be helpful for an AI draft');
    }

    const scope = TenantScope.for(user);
    const studyRows = await db
      .select({
        id: reportStudyInTelerady.id,
        hospitalId: reportStudyInTelerady.hospitalId,
        professionalId: reportStudyInTelerady.professionalId,
      })
      .from(reportStudyInTelerady)
      .where(eq(reportStudyInTelerady.id, reportStudyId))
      .limit(1);
    const study = studyRows[0];
    if (!study) throw new NotFoundException('Study not visible');
    if (study.hospitalId && !scope.isPrivileged) scope.assertCanAct(study.hospitalId);
    if (study.professionalId !== user.professionalId && !scope.isPrivileged) {
      throw new ForbiddenException('AI draft is only available to the assigned radiologist');
    }
    if (!study.hospitalId) {
      throw new ForbiddenException('Study has no hospital scope');
    }

    const [hospital] = await db
      .select({ aiDraftingAllowed: hospitalInTelerady.aiDraftingAllowed })
      .from(hospitalInTelerady)
      .where(eq(hospitalInTelerady.id, study.hospitalId))
      .limit(1);
    if (!hospital?.aiDraftingAllowed) {
      throw new ForbiddenException('AI drafting is disabled for this hospital');
    }

    const [actor] = await db
      .select({ aiConsentAt: appUserInTelerady.aiConsentAt })
      .from(appUserInTelerady)
      .where(eq(appUserInTelerady.id, user.id))
      .limit(1);
    if (!actor?.aiConsentAt && !dto.acceptConsent) {
      throw new ForbiddenException('AI draft requires explicit consent on the first call');
    }
    if (!actor?.aiConsentAt && dto.acceptConsent) {
      await db
        .update(appUserInTelerady)
        .set({ aiConsentAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(appUserInTelerady.id, user.id));
    }

    try {
      const result = await this.client.generate({
        findings: dto.findings,
        reportTitle: dto.reportTitle,
        language: dto.language,
      });
      this.metrics.aiDraftRequests.labels('ok').inc();
      this.metrics.aiDraftLatency.observe(result.latencyMs / 1000);

      await this.audit.append({
        actorId: user.id,
        actorRole: user.roles[0] ?? null,
        hospitalId: study.hospitalId,
        action: 'report.ai_draft_requested',
        targetKind: 'Report',
        targetId: reportStudyId,
        payload: {
          language: dto.language ?? null,
          findingsChars: dto.findings.length,
          responseChars: result.charCount,
          latencyMs: result.latencyMs,
          provider: 'radiogenai',
        },
      });
      return result;
    } catch (err) {
      this.metrics.aiDraftRequests.labels('error').inc();
      throw err;
    }
  }
}
