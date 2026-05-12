import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DBOrTx } from '../../../database/drizzle';
import { reportStudyInTelerady } from '../../../database/schema';
import { ColumnEncryptionService } from '../../../common/crypto/column-encryption.service';
import { TenantScope } from '../../../common/tenant/tenant-scope';
import { SaveReportDto } from '../models/save-report.dto';

export interface ReportPersistenceContext {
  professionalId: string;
  hospitalId: string | null;
}

@Injectable()
export class ReportRepository {
  constructor(private readonly enc: ColumnEncryptionService) {}

  async findForProfessionalAndStudy(
    db: DBOrTx,
    scope: TenantScope,
    professionalId: string,
    studyId: string,
  ) {
    const tenant = scope.whereHospital(reportStudyInTelerady.hospitalId);
    const conditions = [
      eq(reportStudyInTelerady.professionalId, professionalId),
      eq(reportStudyInTelerady.studyIuid, studyId),
    ];
    if (tenant) conditions.push(tenant);

    const rows = await db
      .select()
      .from(reportStudyInTelerady)
      .where(and(...conditions))
      .execute();
    return rows.length > 0 ? this.decryptRow(rows[0]) : null;
  }

  async insertReport(db: DBOrTx, data: SaveReportDto, ctx: ReportPersistenceContext) {
    await db.insert(reportStudyInTelerady).values(this.toEncryptedValues(data, ctx)).execute();
  }

  async updateReport(
    db: DBOrTx,
    data: SaveReportDto,
    id: string,
    ctx: ReportPersistenceContext,
  ) {
    await db
      .update(reportStudyInTelerady)
      .set(this.toEncryptedValues(data, ctx))
      .where(eq(reportStudyInTelerady.id, id))
      .execute();
  }

  private toEncryptedValues(data: SaveReportDto, ctx: ReportPersistenceContext) {
    const aad = `report_study:${ctx.professionalId}`;
    return {
      institution: data.institution,
      hospitalId: ctx.hospitalId,
      // Legacy plaintext columns intentionally left null.
      patBirthdate: null,
      patId: null,
      patName: null,
      patIdEnc: this.enc.encryptIfPresent(data.patId, aad),
      patIdHash: data.patId ? this.enc.lookupHash(data.patId) : null,
      patNameEnc: this.enc.encryptIfPresent(data.patName, aad),
      patBirthdateEnc: this.enc.encryptIfPresent(data.patBirthdate, aad),
      professionalId: ctx.professionalId,
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
