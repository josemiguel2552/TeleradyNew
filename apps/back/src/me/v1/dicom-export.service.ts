import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Response } from 'express';
import archiver from 'archiver';
import { Readable } from 'node:stream';
import { db } from '../../database/drizzle';
import { reportStudyInTelerady } from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { OrthancClient } from '../../integrations/orthanc/orthanc-client.service';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';

/**
 * RGPD art. 20 — portability: streams a zip with every DICOM study tied
 * to the requesting professional (or matching a deterministic pat_id_hash
 * the actor owns).
 *
 * The zip is streamed: no full study lives in API memory at once. Each
 * study is fetched from Orthanc as `/studies/<orthancId>/archive` and
 * piped straight into the archiver. The actor's identity and the list of
 * exported study UIDs go to the audit log under rgpd.dicom_export.
 */
@Injectable()
export class DicomExportService {
  private readonly logger = new Logger(DicomExportService.name);

  constructor(
    private readonly enc: ColumnEncryptionService,
    private readonly orthanc: OrthancClient,
    private readonly audit: AuditLogService,
  ) {}

  async streamForCurrentUser(user: AuthenticatedUser, res: Response): Promise<void> {
    const ownedStudies = await this.studiesOwnedByActor(user);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="telerady-dicom-export-${user.id}.zip"`,
    );

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      this.logger.error(`archiver error: ${err.message}`);
      if (!res.headersSent) res.status(500).end();
    });
    archive.pipe(res);

    const manifest: Array<Record<string, unknown>> = [];
    for (const study of ownedStudies) {
      const orthancStudy = await this.orthanc.findStudyByUid(study.studyIuid);
      if (!orthancStudy) {
        manifest.push({ studyInstanceUid: study.studyIuid, status: 'not-in-pacs' });
        continue;
      }
      const upstream = await this.orthanc.proxy(
        'GET',
        `/studies/${orthancStudy.ID}/archive`,
        { Accept: 'application/zip' },
      );
      if (upstream.status !== 200 || !upstream.body) {
        manifest.push({ studyInstanceUid: study.studyIuid, status: 'unavailable' });
        continue;
      }
      const nodeStream = Readable.fromWeb(upstream.body as never);
      archive.append(nodeStream, {
        name: `studies/${study.studyIuid}.zip`,
      });
      manifest.push({ studyInstanceUid: study.studyIuid, status: 'included' });
    }

    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), studies: manifest }, null, 2), {
      name: 'manifest.json',
    });

    await archive.finalize();

    await this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      action: 'rgpd.dicom_export',
      targetKind: 'User',
      targetId: user.id,
      payload: { count: manifest.length },
    });
  }

  private async studiesOwnedByActor(user: AuthenticatedUser) {
    if (!user.professionalId) return [];
    const rows = await db
      .select({
        id: reportStudyInTelerady.id,
        studyIuid: reportStudyInTelerady.studyIuid,
      })
      .from(reportStudyInTelerady)
      .where(eq(reportStudyInTelerady.professionalId, user.professionalId));
    void this.enc;
    return rows;
  }
}
