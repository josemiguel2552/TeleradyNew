import { Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import {
  mppsEventInTelerady,
  mwlEntryInTelerady,
  reportStudyInTelerady,
} from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { MetricsService } from '../../metrics/metrics.service';
import type { MppsEventDto, MppsEventResponseDto, MppsStatus } from './dto/mpps-event.dto';

const STATUS_TO_MWL: Record<MppsStatus, string> = {
  'IN PROGRESS': 'in_progress',
  COMPLETED: 'completed',
  DISCONTINUED: 'discontinued',
};

/**
 * Ingests one Modality Performed Procedure Step event (DICOM N-CREATE
 * or N-SET) forwarded by Orthanc. Three things happen, all inside a
 * single transaction:
 *
 *   1. Persist the event in `mpps_event` (encrypted raw payload for
 *      replay; rest of the columns indexed for joins).
 *   2. If we recognise the accession number, advance the
 *      `mwl_entry.state` to mirror the MPPS status.
 *   3. If we recognise the studyInstanceUid, link the event row to
 *      the corresponding `report_study` so the worklist UI can pick up
 *      the modality-reported start/end timestamps.
 *
 * Audit gets one row per event (`pacs.mpps_received`) with the chars
 * counts and the join outcome. The patient identifier never appears
 * in the audit payload — MPPS doesn't carry PHI other than the
 * accession number we already index.
 */
@Injectable()
export class MppsService {
  private readonly logger = new Logger(MppsService.name);

  constructor(
    private readonly audit: AuditLogService,
    private readonly enc: ColumnEncryptionService,
    private readonly metrics: MetricsService,
  ) {}

  async ingest(dto: MppsEventDto): Promise<MppsEventResponseDto> {
    return db.transaction(async (tx) => {
      // 1) Look up the join targets first (read-only).
      const mwlMatch = dto.accessionNumber
        ? await tx
            .select({ id: mwlEntryInTelerady.id, hospitalId: mwlEntryInTelerady.hospitalId })
            .from(mwlEntryInTelerady)
            .where(eq(mwlEntryInTelerady.accessionNumber, dto.accessionNumber))
            .limit(1)
        : [];
      const mwlEntry = mwlMatch[0] ?? null;

      const studyMatch = dto.studyInstanceUid
        ? await tx
            .select({ id: reportStudyInTelerady.id, hospitalId: reportStudyInTelerady.hospitalId })
            .from(reportStudyInTelerady)
            .where(eq(reportStudyInTelerady.studyIuid, dto.studyInstanceUid))
            .limit(1)
        : [];
      const reportStudy = studyMatch[0] ?? null;

      const hospitalId = reportStudy?.hospitalId ?? mwlEntry?.hospitalId ?? null;

      // 2) Upsert the event row (one PerformedProcedureStepID = one
      //    row; N-SET updates the existing row with the new status).
      const existing = await tx
        .select({ id: mppsEventInTelerady.id })
        .from(mppsEventInTelerady)
        .where(eq(mppsEventInTelerady.performedProcedureStepId, dto.performedProcedureStepId))
        .limit(1);
      const aad = `mpps_event:${dto.performedProcedureStepId}`;
      const rawEnc = this.enc.encrypt(JSON.stringify(dto), aad);
      const baseValues = {
        performedProcedureStepId: dto.performedProcedureStepId,
        accessionNumber: dto.accessionNumber ?? null,
        studyIuid: dto.studyInstanceUid ?? null,
        status: dto.status,
        modality: dto.modality ?? null,
        stationName: dto.stationName ?? null,
        hospitalId,
        mwlEntryId: mwlEntry?.id ?? null,
        reportStudyId: reportStudy?.id ?? null,
        startedAt: dto.startDateTime ?? null,
        endedAt: dto.endDateTime ?? null,
        rawPayloadEnc: rawEnc,
        processedAt: sql`now()`,
      };

      let eventId: string;
      let outcome: 'new' | 'update';
      if (existing[0]) {
        await tx
          .update(mppsEventInTelerady)
          .set(baseValues)
          .where(eq(mppsEventInTelerady.id, existing[0].id));
        eventId = existing[0].id;
        outcome = 'update';
      } else {
        const [row] = await tx
          .insert(mppsEventInTelerady)
          .values(baseValues)
          .returning({ id: mppsEventInTelerady.id });
        eventId = row.id;
        outcome = 'new';
      }

      // 3) Mirror the MPPS status onto the MWL entry. Only forward
      //    transitions are applied — we never move a "completed"
      //    entry back to "in_progress".
      if (mwlEntry) {
        const nextState = STATUS_TO_MWL[dto.status];
        await tx
          .update(mwlEntryInTelerady)
          .set({ state: nextState })
          .where(
            and(
              eq(mwlEntryInTelerady.id, mwlEntry.id),
              // Don't downgrade from `completed`.
              sql`state <> 'completed'`,
            ),
          );
      }

      this.metrics.mppsEvents.labels(dto.status).inc();

      await this.audit.append(
        {
          actorId: null,
          actorRole: 'system',
          hospitalId,
          action: 'pacs.mpps_received',
          targetKind: 'MppsEvent',
          targetId: eventId,
          payload: {
            performedProcedureStepId: dto.performedProcedureStepId,
            status: dto.status,
            modality: dto.modality ?? null,
            stationName: dto.stationName ?? null,
            accessionMatched: !!mwlEntry,
            studyMatched: !!reportStudy,
            outcome,
          },
        },
        tx,
      );

      return {
        eventId,
        outcome,
        mwlEntryId: mwlEntry?.id ?? null,
        reportStudyId: reportStudy?.id ?? null,
      };
    });
  }
}
