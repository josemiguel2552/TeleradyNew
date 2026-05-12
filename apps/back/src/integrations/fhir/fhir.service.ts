import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import {
  hospitalInTelerady,
  professionalInTelerady,
  reportInTelerady,
  reportStudyInTelerady,
} from '../../database/schema';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { reportInTelerady as reportTable } from '../../database/schema';
void reportTable;
import { StorageService } from '../storage/storage.service';
import { TenantScope } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import type {
  FhirBundle,
  FhirDiagnosticReport,
  FhirImagingStudy,
  FhirPatient,
} from './fhir.types';

const FHIR_BASE_SYSTEM = 'urn:telerady';

@Injectable()
export class FhirService {
  constructor(
    private readonly enc: ColumnEncryptionService,
    private readonly storage: StorageService,
  ) {}

  async getPatient(user: AuthenticatedUser, patientIdHash: string): Promise<FhirPatient> {
    const scope = TenantScope.for(user);
    const tenant = scope.whereHospital(reportStudyInTelerady.hospitalId);
    const conditions: SQL[] = [eq(reportStudyInTelerady.patIdHash, patientIdHash)];
    if (tenant) conditions.push(tenant);
    const rows = await db
      .select()
      .from(reportStudyInTelerady)
      .where(and(...conditions))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException('Patient not visible');
    const aad = `report_study:${row.professionalId}`;
    return this.toPatient(patientIdHash, {
      name: this.enc.decryptIfPresent(row.patNameEnc, aad),
      birthDate: this.enc.decryptIfPresent(row.patBirthdateEnc, aad),
      sex: row.sex,
    });
  }

  async searchImagingStudies(
    user: AuthenticatedUser,
    params: { patient?: string; modality?: string },
  ): Promise<FhirBundle<FhirImagingStudy>> {
    const scope = TenantScope.for(user);
    const tenant = scope.whereHospital(reportStudyInTelerady.hospitalId);
    const conditions: SQL[] = [];
    if (tenant) conditions.push(tenant);
    if (params.patient) {
      conditions.push(eq(reportStudyInTelerady.patIdHash, this.parsePatientReference(params.patient)));
    }
    if (params.modality) {
      conditions.push(sql`${params.modality} = ANY (${reportStudyInTelerady.modalities})`);
    }
    const rows = await db
      .select()
      .from(reportStudyInTelerady)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(200);

    const entries = rows.map((row) => {
      const aad = `report_study:${row.professionalId}`;
      void this.enc.decryptIfPresent(row.patNameEnc, aad); // touched for AAD validation
      return {
        fullUrl: `urn:uuid:${row.id}`,
        resource: this.toImagingStudy(row),
      };
    });

    return {
      resourceType: 'Bundle',
      id: cryptoRandom(),
      type: 'searchset',
      total: entries.length,
      entry: entries,
    };
  }

  async getDiagnosticReport(
    user: AuthenticatedUser,
    reportId: string,
  ): Promise<FhirDiagnosticReport> {
    const scope = TenantScope.for(user);
    const tenant = scope.whereHospital(reportInTelerady.hospitalId);
    const conditions: SQL[] = [eq(reportInTelerady.id, reportId)];
    if (tenant) conditions.push(tenant);
    const reportRows = await db
      .select()
      .from(reportInTelerady)
      .where(and(...conditions))
      .limit(1);
    const row = reportRows[0];
    if (!row) throw new NotFoundException('Report not visible');

    const studyRows = await db
      .select()
      .from(reportStudyInTelerady)
      .where(eq(reportStudyInTelerady.id, row.reportStudyId))
      .limit(1);
    const study = studyRows[0];

    let presentedForm: FhirDiagnosticReport['presentedForm'];
    if (row.pdfKey) {
      const url = await this.storage.signedGetUrl(row.pdfKey, 'reports', 300);
      presentedForm = [{ contentType: 'application/pdf', url, title: 'Signed report PDF' }];
    }

    let conclusion: string | undefined;
    if (row.contentsEnc) {
      try {
        const parsed = JSON.parse(this.enc.decrypt(row.contentsEnc, `report:${row.reportStudyId}`));
        conclusion = parsed?.sections
          ?.map((s: { title: string; body: string }) => `${s.title}\n${s.body}`)
          .join('\n\n');
      } catch {
        /* leave undefined */
      }
    }

    return {
      resourceType: 'DiagnosticReport',
      id: row.id,
      identifier: [{ system: `${FHIR_BASE_SYSTEM}:report`, value: row.id }],
      status: this.mapReportStatus(row.state),
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'RAD',
              display: 'Radiology',
            },
          ],
        },
      ],
      code: { text: 'Radiology report' },
      subject: { reference: `Patient/${study?.patIdHash ?? 'unknown'}` },
      effectiveDateTime: study?.studyCreatedTime ?? undefined,
      issued: row.signedAt ?? undefined,
      performer: [{ reference: `Practitioner/${row.professionalId}` }],
      imagingStudy: study ? [{ reference: `ImagingStudy/${study.id}` }] : undefined,
      conclusion,
      presentedForm,
    };
  }

  async searchDiagnosticReports(
    user: AuthenticatedUser,
    params: { patient?: string; status?: string },
  ): Promise<FhirBundle<FhirDiagnosticReport>> {
    const scope = TenantScope.for(user);
    const tenant = scope.whereHospital(reportInTelerady.hospitalId);
    const conditions: SQL[] = [];
    if (tenant) conditions.push(tenant);
    if (params.status) conditions.push(eq(reportInTelerady.state, this.mapStateFromFhirStatus(params.status)));

    let studyIds: string[] | null = null;
    if (params.patient) {
      const hashed = this.parsePatientReference(params.patient);
      const studyRows = await db
        .select({ id: reportStudyInTelerady.id })
        .from(reportStudyInTelerady)
        .where(eq(reportStudyInTelerady.patIdHash, hashed));
      studyIds = studyRows.map((s) => s.id);
      if (!studyIds.length) {
        return { resourceType: 'Bundle', id: cryptoRandom(), type: 'searchset', total: 0, entry: [] };
      }
      conditions.push(sql`${reportInTelerady.reportStudyId} = ANY (${studyIds})`);
    }

    const rows = await db
      .select()
      .from(reportInTelerady)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(200);

    const entries = await Promise.all(
      rows.map(async (r) => ({
        fullUrl: `urn:uuid:${r.id}`,
        resource: await this.getDiagnosticReport(user, r.id),
      })),
    );
    return {
      resourceType: 'Bundle',
      id: cryptoRandom(),
      type: 'searchset',
      total: entries.length,
      entry: entries,
    };
  }

  /**
   * Accepts a FHIR DiagnosticReport from an external HIS and creates the
   * corresponding draft report row. The bridge is intentionally lenient:
   * we accept `subject.identifier.value` *or* `subject.reference` to find
   * the patient, and we tolerate a missing imagingStudy if the body
   * carries enough text to be persisted as a draft.
   */
  async createDiagnosticReport(
    user: AuthenticatedUser,
    body: Partial<FhirDiagnosticReport> & {
      subject?: { reference?: string; identifier?: { value?: string } };
    },
  ) {
    if (!user.professionalId) {
      throw new BadRequestException('Only a registered professional can create a report');
    }
    if (body.resourceType !== 'DiagnosticReport') {
      throw new BadRequestException('Expected resourceType=DiagnosticReport');
    }
    const studyRef = body.imagingStudy?.[0]?.reference?.replace(/^ImagingStudy\//, '');
    if (!studyRef) {
      throw new BadRequestException('imagingStudy reference is required');
    }
    const studyRows = await db
      .select()
      .from(reportStudyInTelerady)
      .where(eq(reportStudyInTelerady.id, studyRef))
      .limit(1);
    const study = studyRows[0];
    if (!study) throw new NotFoundException('Study not visible');

    const scope = TenantScope.for(user);
    if (study.hospitalId && !scope.isPrivileged) scope.assertCanAct(study.hospitalId);

    const text = body.conclusion ?? '';
    const aad = `report:${study.id}`;
    const contents = {
      modality: (study.modalities ?? [])[0] ?? 'OTHER',
      sections: [{ key: 'conclusion', title: 'Conclusion', body: text }],
      metadata: { source: 'fhir', externalId: body.identifier?.[0]?.value ?? null },
    };
    const [row] = await db
      .insert(reportInTelerady)
      .values({
        reportStudyId: study.id,
        hospitalId: study.hospitalId,
        professionalId: user.professionalId,
        contentsEnc: this.enc.encrypt(JSON.stringify(contents), aad),
        state: 'draft',
        version: 1,
      })
      .onConflictDoNothing({ target: reportInTelerady.reportStudyId })
      .returning();
    return {
      resourceType: 'DiagnosticReport',
      id: row?.id ?? study.id,
      status: 'preliminary',
      created: true,
    };
  }

  private parsePatientReference(ref: string): string {
    // Accepts `Patient/<hash>` or just `<hash>`.
    return ref.startsWith('Patient/') ? ref.slice('Patient/'.length) : ref;
  }

  private toPatient(
    patientIdHash: string,
    fields: { name: string | null; birthDate: string | null; sex: string | null },
  ): FhirPatient {
    const out: FhirPatient = {
      resourceType: 'Patient',
      id: patientIdHash,
      identifier: [
        { system: `${FHIR_BASE_SYSTEM}:patient-id-hash`, value: patientIdHash },
      ],
    };
    if (fields.name) {
      const parts = fields.name.split('^').filter(Boolean);
      out.name = [{ family: parts[0], given: parts.slice(1), text: fields.name.replace(/\^/g, ' ') }];
    }
    if (fields.birthDate) out.birthDate = this.toIsoDate(fields.birthDate);
    if (fields.sex) {
      const map: Record<string, FhirPatient['gender']> = {
        M: 'male',
        F: 'female',
        O: 'other',
        U: 'unknown',
      };
      out.gender = map[fields.sex.toUpperCase()] ?? 'unknown';
    }
    return out;
  }

  private toImagingStudy(row: typeof reportStudyInTelerady.$inferSelect): FhirImagingStudy {
    return {
      resourceType: 'ImagingStudy',
      id: row.id,
      identifier: [
        { system: `${FHIR_BASE_SYSTEM}:study-iuid`, value: row.studyIuid },
      ],
      status: 'available',
      subject: { reference: `Patient/${row.patIdHash ?? 'unknown'}` },
      started: row.studyCreatedTime ?? undefined,
      modality: (row.modalities ?? []).map((m) => ({
        system: 'http://dicom.nema.org/resources/ontology/DCM',
        code: m,
      })),
      description: row.studyDesc ?? undefined,
    };
  }

  private toIsoDate(dicomLike: string): string | undefined {
    if (!dicomLike) return undefined;
    if (dicomLike.includes('-')) return dicomLike;
    if (/^\d{8}$/.test(dicomLike)) {
      return `${dicomLike.slice(0, 4)}-${dicomLike.slice(4, 6)}-${dicomLike.slice(6, 8)}`;
    }
    return dicomLike;
  }

  private mapReportStatus(state: string): FhirDiagnosticReport['status'] {
    switch (state) {
      case 'draft':
        return 'preliminary';
      case 'finalized':
        return 'partial';
      case 'signed':
        return 'final';
      case 'sent':
        return 'final';
      default:
        return 'unknown';
    }
  }

  private mapStateFromFhirStatus(status: string): string {
    switch (status) {
      case 'preliminary':
        return 'draft';
      case 'partial':
        return 'finalized';
      case 'final':
        return 'signed';
      default:
        return status;
    }
  }
}

function cryptoRandom(): string {
  // Lightweight v4 UUID — Bundle.id needs to be globally unique per response
  // but not cryptographically strong; using `crypto.randomUUID()` if available.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomUUID } = require('node:crypto') as typeof import('node:crypto');
  return randomUUID();
}

void hospitalInTelerady;
void professionalInTelerady;
