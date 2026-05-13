import {
  ForbiddenException,
  Inject,
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
import {
  AI_DRAFT_PROVIDER,
  AiDraftProvider,
  AiDraftStreamChunk,
  AiDraftStreamSummary,
} from '../../integrations/ai/ai-draft.provider';
import type { AiDraftRequestDto, AiDraftResponseDto } from './dto/ai-draft.dto';

interface ResolvedTarget {
  reportStudyId: string;
  hospitalId: string;
}

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
    @Inject(AI_DRAFT_PROVIDER) private readonly client: AiDraftProvider,
    private readonly audit: AuditLogService,
    private readonly metrics: MetricsService,
  ) {}

  async generate(
    reportStudyId: string,
    dto: AiDraftRequestDto,
    user: AuthenticatedUser,
  ): Promise<AiDraftResponseDto> {
    const target = await this.assertCanGenerate(reportStudyId, dto, user);
    try {
      const result = await this.client.generate({
        findings: dto.findings,
        reportTitle: dto.reportTitle,
        language: dto.language,
      });
      this.metrics.aiDraftRequests.labels('ok').inc();
      this.metrics.aiDraftLatency.observe(result.latencyMs / 1000);
      await this.recordAudit(user, target, dto, {
        latencyMs: result.latencyMs,
        charCount: result.charCount,
      });
      return result;
    } catch (err) {
      this.metrics.aiDraftRequests.labels('error').inc();
      throw err;
    }
  }

  /**
   * Streaming variant — runs the same precondition gate, then yields
   * each `data: …` line the upstream emits as a `{ text }` chunk so the
   * SPA can paint the draft live. Audit + metrics are written once the
   * generator is closed (success or upstream error), so the operator
   * sees latency and char counts whether the stream completed or got
   * cut short.
   */
  async *generateStream(
    reportStudyId: string,
    dto: AiDraftRequestDto,
    user: AuthenticatedUser,
  ): AsyncGenerator<AiDraftStreamChunk, void, unknown> {
    const target = await this.assertCanGenerate(reportStudyId, dto, user);
    let summary: AiDraftStreamSummary = { latencyMs: 0, charCount: 0 };
    let outcome: 'ok' | 'error' = 'ok';
    try {
      yield* this.client.generateStream(
        {
          findings: dto.findings,
          reportTitle: dto.reportTitle,
          language: dto.language,
        },
        (s) => {
          summary = s;
        },
      );
    } catch (err) {
      outcome = 'error';
      throw err;
    } finally {
      this.metrics.aiDraftRequests.labels(outcome).inc();
      if (summary.charCount > 0) {
        this.metrics.aiDraftLatency.observe(summary.latencyMs / 1000);
      }
      // Always audit, even on error: the operator needs to see that the
      // call was attempted, with whatever the upstream managed to emit
      // before failing.
      await this.recordAudit(user, target, dto, summary, outcome).catch(() => undefined);
    }
  }

  private async assertCanGenerate(
    reportStudyId: string,
    dto: AiDraftRequestDto,
    user: AuthenticatedUser,
  ): Promise<ResolvedTarget> {
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

    return { reportStudyId, hospitalId: study.hospitalId };
  }

  private recordAudit(
    user: AuthenticatedUser,
    target: ResolvedTarget,
    dto: AiDraftRequestDto,
    summary: AiDraftStreamSummary,
    outcome: 'ok' | 'error' = 'ok',
  ): Promise<unknown> {
    return this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      hospitalId: target.hospitalId,
      action: 'report.ai_draft_requested',
      targetKind: 'Report',
      targetId: target.reportStudyId,
      payload: {
        language: dto.language ?? null,
        findingsChars: dto.findings.length,
        responseChars: summary.charCount,
        latencyMs: summary.latencyMs,
        provider: this.client.providerName,
        outcome,
      },
    });
  }
}
