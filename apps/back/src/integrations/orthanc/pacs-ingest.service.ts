import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import { reportStudyInTelerady } from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { TenantScope } from '../../common/tenant/tenant-scope';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { WorkflowEngine } from '../../workflows/v1/workflow-engine.service';
import { PushService } from '../push/push.service';
import { OrthancClient, type OrthancStudy } from './orthanc-client.service';

const DEFAULT_PENDING_STATE_ID = 1;

export interface SyncStudyInput {
  studyInstanceUid: string;
  hospitalId?: string;
  professionalId?: string;
}

export interface SyncStudyResult {
  reportStudyId: string;
  studyInstanceUid: string;
  action: 'created' | 'updated';
  hospitalId: string | null;
}

/**
 * Ingests a study from Orthanc into telerady.report_study, encrypting PII
 * fields and tagging the row with the right hospital_id. Intended for the
 * SPA to call right after a STOW-RS upload, and for an Orthanc plugin hook
 * to call when a study becomes Stable.
 */
@Injectable()
export class PacsIngestService {
  constructor(
    private readonly orthanc: OrthancClient,
    private readonly enc: ColumnEncryptionService,
    private readonly audit: AuditLogService,
    private readonly workflow: WorkflowEngine,
    private readonly push: PushService,
  ) {}

  async sync(actor: AuthenticatedUser, input: SyncStudyInput): Promise<SyncStudyResult> {
    const study = await this.orthanc.findStudyByUid(input.studyInstanceUid);
    if (!study) throw new NotFoundException('Study not found in PACS');

    const scope = TenantScope.for(actor);
    const hospitalId = this.resolveHospitalId(actor, scope, input.hospitalId);
    const professionalId = this.resolveProfessionalId(actor, scope, input.professionalId);
    if (!professionalId) {
      throw new BadRequestException(
        'professionalId is required when the actor has no professional binding',
      );
    }

    const dicomFields = extractFields(study);
    const aad = `report_study:${professionalId}`;

    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: reportStudyInTelerady.id,
          hospitalId: reportStudyInTelerady.hospitalId,
        })
        .from(reportStudyInTelerady)
        .where(eq(reportStudyInTelerady.studyIuid, input.studyInstanceUid))
        .limit(1);

      const values = {
        hospitalId,
        professionalId,
        studyIuid: input.studyInstanceUid,
        studyDesc: dicomFields.studyDescription ?? '',
        institution: dicomFields.institution ?? '',
        sex: dicomFields.sex ?? '',
        src: 'orthanc',
        modalities: dicomFields.modalities,
        patId: null,
        patName: null,
        patBirthdate: null,
        patIdEnc: this.enc.encryptIfPresent(dicomFields.patientId, aad),
        patIdHash: dicomFields.patientId ? this.enc.lookupHash(dicomFields.patientId) : null,
        patNameEnc: this.enc.encryptIfPresent(dicomFields.patientName, aad),
        patBirthdateEnc: this.enc.encryptIfPresent(dicomFields.patientBirthDate, aad),
        studyCreatedTime: dicomFields.studyCreatedAt ?? null,
        reportStateId: DEFAULT_PENDING_STATE_ID,
      };

      let reportStudyId: string;
      let action: 'created' | 'updated';

      if (existing.length) {
        if (existing[0].hospitalId && existing[0].hospitalId !== hospitalId) {
          scope.assertCanAct(existing[0].hospitalId);
        }
        await tx
          .update(reportStudyInTelerady)
          .set(values)
          .where(eq(reportStudyInTelerady.id, existing[0].id));
        reportStudyId = existing[0].id;
        action = 'updated';
      } else {
        const [row] = await tx
          .insert(reportStudyInTelerady)
          .values(values)
          .returning({ id: reportStudyInTelerady.id });
        reportStudyId = row.id;
        action = 'created';
      }

      // Auto-assign primary based on workflow rules. Only applied on first
      // ingest so a manual reassignment via /v1/admin/studies/:id/assign
      // survives re-syncs.
      let appliedRuleId: string | null = null;
      let assignedProfessionalId: string | null = null;
      if (action === 'created' && hospitalId) {
        const decision = await this.workflow.applyToStudy(tx, reportStudyId, {
          hospitalId,
          modalities: dicomFields.modalities,
          subspecialtyId: null,
        });
        appliedRuleId = decision.matchedRuleId;
        assignedProfessionalId = decision.professionalId;
      }

      await this.audit.append(
        {
          actorId: actor.id,
          actorRole: actor.roles[0] ?? null,
          hospitalId,
          action: action === 'created' ? 'study.ingested' : 'study.reingested',
          targetKind: 'ReportStudy',
          targetId: reportStudyId,
          payload: {
            studyInstanceUid: input.studyInstanceUid,
            modalities: dicomFields.modalities,
            // pat_id is pseudonymised before logging.
            patIdHash: values.patIdHash,
            appliedRuleId,
          },
        },
        tx,
      );

      // Notify the matched primary out-of-band. The push is fire &
      // forget — it never blocks the ingest transaction and a missing
      // device just leaves the worklist as the canonical surface.
      if (assignedProfessionalId) {
        void this.push
          .sendToProfessional(assignedProfessionalId, {
            title: 'Estudio nuevo',
            body: `Modalidad ${dicomFields.modalities.join('/') || '—'} en tu worklist.`,
            url: `/radiologist/study/${reportStudyId}`,
            tag: `study-ingested-${reportStudyId}`,
            category: 'study_ingested',
          })
          .catch(() => undefined);
      }

      return {
        reportStudyId,
        studyInstanceUid: input.studyInstanceUid,
        action,
        hospitalId,
      };
    });
  }

  private resolveHospitalId(
    actor: AuthenticatedUser,
    scope: TenantScope,
    requested: string | undefined,
  ): string | null {
    if (scope.isPrivileged) return requested ?? null;
    if (requested) {
      scope.assertCanAct(requested);
      return requested;
    }
    if (actor.hospitalIds.length === 1) return actor.hospitalIds[0];
    if (actor.hospitalIds.length === 0) {
      throw new ForbiddenException('No hospital membership; cannot ingest study');
    }
    throw new BadRequestException(
      'hospitalId is required when the user belongs to multiple hospitals',
    );
  }

  private resolveProfessionalId(
    actor: AuthenticatedUser,
    scope: TenantScope,
    requested: string | undefined,
  ): string | null {
    if (requested) {
      if (!scope.isPrivileged && !actor.roles.includes(Role.HospitalAdmin)) {
        throw new ForbiddenException('Only admins/coordinators can override professionalId');
      }
      return requested;
    }
    return actor.professionalId ?? null;
  }
}

interface ExtractedFields {
  studyDescription: string | null;
  institution: string | null;
  patientId: string | null;
  patientName: string | null;
  patientBirthDate: string | null;
  sex: string | null;
  modalities: string[];
  studyCreatedAt: string | null;
}

function extractFields(study: OrthancStudy): ExtractedFields {
  const main = study.MainDicomTags ?? ({} as OrthancStudy['MainDicomTags']);
  const patient = study.PatientMainDicomTags ?? {};
  return {
    studyDescription: main.StudyDescription ?? null,
    institution: study.InstitutionName ?? null,
    patientId: patient.PatientID ?? null,
    patientName: patient.PatientName ?? null,
    patientBirthDate: patient.PatientBirthDate ?? null,
    sex: patient.PatientSex ?? null,
    modalities: study.ModalitiesInStudy ?? [],
    studyCreatedAt: buildIsoTimestamp(main.StudyDate, main.StudyTime),
  };
}

function buildIsoTimestamp(date?: string, time?: string): string | null {
  if (!date) return null;
  // DICOM StudyDate is YYYYMMDD; StudyTime is HHMMSS (optionally with fractional).
  const yyyy = date.slice(0, 4);
  const mm = date.slice(4, 6);
  const dd = date.slice(6, 8);
  if (!yyyy || !mm || !dd) return null;
  const hh = time ? time.slice(0, 2) || '00' : '00';
  const min = time ? time.slice(2, 4) || '00' : '00';
  const ss = time ? time.slice(4, 6) || '00' : '00';
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
}
