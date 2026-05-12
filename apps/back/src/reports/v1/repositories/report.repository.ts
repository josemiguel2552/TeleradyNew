import { Injectable } from "@nestjs/common";
import { DBOrTx } from "../../../database/drizzle";
import { reportStudyInTelerady } from "../../../database/schema";
import { SaveReportDto } from "../models/save-report.dto";
import { and, eq } from "drizzle-orm";

@Injectable()
export class ReportRepository {
    constructor() { }

    async getReport(db: DBOrTx, idProfessional: string, studyId: string) {
        const report = await db.select()
            .from(reportStudyInTelerady)
            .where(and(
                eq(reportStudyInTelerady.professionalId, idProfessional),
                eq(reportStudyInTelerady.studyIuid, studyId)
            ))
            .execute();
        return report.length > 0 ? report[0] : null;
    }

    async insertReport(db: DBOrTx, data: SaveReportDto) {
        await db.insert(reportStudyInTelerady).values({
            institution: data.institution,
            patBirthdate: data.patBirthdate,
            patId: data.patId,
            patName: data.patName,
            professionalId: data.idProfessional,
            reportStateId: data.idReportState,
            sex: data.sex,
            src: data.src,
            studyDesc: data.studyDesc,
            studyIuid: data.studyId,
            modalities: data.modalities
        }).execute();
    }

    async updateReport(db: DBOrTx, data: SaveReportDto, id: string) {
        await db.update(reportStudyInTelerady).set({
            institution: data.institution,
            patBirthdate: data.patBirthdate,
            patId: data.patId,
            patName: data.patName,
            professionalId: data.idProfessional,
            reportStateId: data.idReportState,
            sex: data.sex,
            src: data.src,
            studyDesc: data.studyDesc,
            studyIuid: data.studyId,
            modalities: data.modalities
        }).where(eq(reportStudyInTelerady.id, id)).execute();
    }
}