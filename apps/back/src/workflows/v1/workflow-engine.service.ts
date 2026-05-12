import { Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { DBOrTx } from '../../database/drizzle';
import { assignmentRuleInTelerady, reportStudyInTelerady } from '../../database/schema';

export interface AssignmentDecision {
  professionalId: string | null;
  requiresReview: boolean;
  matchedRuleId: string | null;
}

/**
 * Applies tenant-scoped assignment rules to a freshly ingested study.
 *
 * Match order: most specific (hospital + modality + subspecialty) first,
 * then progressively broader. A NULL field on a rule means "any" — so a
 * rule with `(hospital=H, modality=NULL, subspecialty=NULL)` is the
 * catch-all for hospital H.
 *
 * Ties broken by `priority` ascending (lower number wins).
 */
@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);

  async decide(
    db: DBOrTx,
    input: { hospitalId: string | null; modalities: string[]; subspecialtyId: number | null },
  ): Promise<AssignmentDecision> {
    const conditions: SQL[] = [eq(assignmentRuleInTelerady.active, true)];

    if (input.hospitalId) {
      const hospitalClause = or(
        eq(assignmentRuleInTelerady.hospitalId, input.hospitalId),
        isNull(assignmentRuleInTelerady.hospitalId),
      );
      if (hospitalClause) conditions.push(hospitalClause);
    } else {
      conditions.push(isNull(assignmentRuleInTelerady.hospitalId));
    }

    const rows = await db
      .select()
      .from(assignmentRuleInTelerady)
      .where(and(...conditions))
      .orderBy(asc(assignmentRuleInTelerady.priority));

    for (const rule of rows) {
      if (rule.modality && !input.modalities.includes(rule.modality)) continue;
      if (rule.subspecialtyId !== null && rule.subspecialtyId !== input.subspecialtyId) continue;
      if (!rule.targetProfessionalId) continue;
      this.logger.debug(`assignment rule ${rule.id} matched -> ${rule.targetProfessionalId}`);
      return {
        professionalId: rule.targetProfessionalId,
        requiresReview: rule.requiresReview,
        matchedRuleId: rule.id,
      };
    }
    return { professionalId: null, requiresReview: false, matchedRuleId: null };
  }

  /**
   * Convenience helper for the ingest path: applies the rule to a freshly
   * persisted report_study row, updating both the professional_id and the
   * future report's requires_review flag when a rule matched.
   */
  async applyToStudy(
    db: DBOrTx,
    reportStudyId: string,
    input: { hospitalId: string | null; modalities: string[]; subspecialtyId: number | null },
  ): Promise<AssignmentDecision> {
    const decision = await this.decide(db, input);
    if (decision.professionalId) {
      await db
        .update(reportStudyInTelerady)
        .set({ professionalId: decision.professionalId })
        .where(eq(reportStudyInTelerady.id, reportStudyId));
    }
    return decision;
  }
}

void sql; // keep `sql` import alive for downstream callers that compose conditions