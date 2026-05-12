import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import { reportStudyInTelerady } from '../../database/schema';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { OrthancClient } from '../../integrations/orthanc/orthanc-client.service';
import { buildBasicTextSr } from '../../integrations/orthanc/dicom-sr-builder';
import type { ReportRow } from './report-v2.repository';

interface ContentsShape {
  modality?: string;
  sections?: Array<{ key: string; title: string; body: string }>;
}

/**
 * Pushes a DICOM Basic Text Structured Report back into Orthanc once a
 * report has been signed. Best-effort: failures are logged but never
 * abort the signing flow — the signed PDF in S3 stays the source of
 * truth for the platform.
 */
@Injectable()
export class SrPusherService {
  private readonly logger = new Logger(SrPusherService.name);

  constructor(
    private readonly enc: ColumnEncryptionService,
    private readonly orthanc: OrthancClient,
  ) {}

  async pushFor(report: ReportRow): Promise<{ orthancId: string | null }> {
    try {
      const studyRows = await db
        .select()
        .from(reportStudyInTelerady)
        .where(eq(reportStudyInTelerady.id, report.reportStudyId))
        .limit(1);
      const study = studyRows[0];
      if (!study) return { orthancId: null };

      const aad = `report_study:${study.professionalId}`;
      const patientId = this.enc.decryptIfPresent(study.patIdEnc, aad) ?? 'UNKNOWN';
      const patientName = this.enc.decryptIfPresent(study.patNameEnc, aad) ?? 'UNKNOWN^';
      const patientBirth =
        this.enc.decryptIfPresent(study.patBirthdateEnc, aad) ?? undefined;

      const contents = report.contents as ContentsShape | null;
      const reportText = (contents?.sections ?? [])
        .map((s) => `${s.title.toUpperCase()}\n${s.body}`)
        .join('\n\n');

      const signature = report.signatureData as Record<string, unknown> | null;
      const signedBy = (signature?.['displayedName'] as string) ?? 'Telerady';
      const contentsDigest = (signature?.['contentsDigest'] as string) ?? '';

      const body = buildBasicTextSr({
        studyInstanceUid: study.studyIuid,
        patientId,
        patientName,
        patientBirthdate: patientBirth ?? undefined,
        patientSex: study.sex ?? undefined,
        reportText,
        signedBy,
        signedAt: report.signedAt ?? new Date().toISOString(),
        contentsDigest,
      });

      const result = await this.orthanc.pushDicomFromJson(body);
      if (!result) {
        this.logger.warn(`Orthanc rejected SR for report ${report.id}`);
        return { orthancId: null };
      }
      this.logger.log(`SR pushed for report ${report.id} as ${result.id}`);
      return { orthancId: result.id };
    } catch (err) {
      this.logger.warn(`SR push failed: ${(err as Error).message}`);
      return { orthancId: null };
    }
  }
}
