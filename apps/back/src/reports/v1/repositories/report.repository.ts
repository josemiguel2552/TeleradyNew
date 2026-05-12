import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DBOrTx } from '../../../database/drizzle';
import { reportStudyInTelerady } from '../../../database/schema';
import { ColumnEncryptionService } from '../../../common/crypto/column-encryption.service';
import { SaveReportDto } from '../models/save-report.dto';

@Injectable()
export class ReportRepository {
  constructor(private readonly enc: ColumnEncryptionService) {}

  async getReport(db: DBOrTx, idProfessional: string, studyId: string) {
    const rows = await db
      .select()
      .from(reportStudyInTelerady)
      .where(
        and(
          eq(reportStudyInTelerady.professionalId, idProfessional),
          eq(reportStudyInTelerady.studyIuid, studyId),
        ),
      )
      .execute();
    return rows.length > 0 ? this.decryptRow(rows[0]) : null;
  }

  async insertReport(db: DBOrTx, data: SaveReportDto) {
    await db
      .insert(reportStudyInTelerady)
      .values(this.toEncryptedValues(data))
      .execute();
  }

  async updateReport(db: DBOrTx, data: SaveReportDto, id: string) {
    await db
      .update(reportStudyInTelerady)
      .set(this.toEncryptedValues(data))
      .where(eq(reportStudyInTelerady.id, id))
      .execute();
  }

  private toEncryptedValues(data: SaveReportDto) {
    const aad = `report_study:${data.idProfessional}`;
    return {
      institution: data.institution,
      // Plaintext columns intentionally left null. Drop in Sprint 2.
      patBirthdate: null,
      patId: null,
      patName: null,
      patIdEnc: this.enc.encryptIfPresent(data.patId, aad),
      patIdHash: data.patId ? this.enc.lookupHash(data.patId) : null,
      patNameEnc: this.enc.encryptIfPresent(data.patName, aad),
      patBirthdateEnc: this.enc.encryptIfPresent(data.patBirthdate, aad),
      professionalId: data.idProfessional,
      reportStateId: data.idReportState,
      sex: data.sex,
      src: data.src,
      studyDesc: data.studyDesc,
      studyIuid: data.studyId,
      modalities: data.modalities,
    };
  }

  private decryptRow(row: typeof reportStudyInTelerady.$inferSelect) {
    const aad = `report_study:${row.professionalId}`;
    return {
      ...row,
      patId: this.enc.decryptIfPresent(row.patIdEnc, aad) ?? row.patId,
      patName: this.enc.decryptIfPresent(row.patNameEnc, aad) ?? row.patName,
      patBirthdate:
        this.enc.decryptIfPresent(row.patBirthdateEnc, aad) ?? row.patBirthdate,
    };
  }
}
