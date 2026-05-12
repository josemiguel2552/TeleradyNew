import { Injectable } from "@nestjs/common";
import { authUser, getTitleSpecialty, professionalDocumentInTelerady, professionalInTelerady, professionalSubspecialtyInTelerady } from "../../../database/schema";
import { I18nService } from "../../../i18n/i18n.service";
import { eq, and, sql } from "drizzle-orm";
import { SaveProfessionalDto } from "../models/save-professional.dto";
import { DBOrTx } from "../../../database/drizzle";

@Injectable()
export class PersonalDataRepository {
    constructor(private readonly i18n: I18nService) { }

    async validateProfessional(db: DBOrTx, email: string): Promise<boolean> {
        const userAuth = await db.select().from(authUser).where(eq(authUser.email, email)).execute();
        if (userAuth.length === 0) {
            return false;
        }
        const userProfessional = await db.select().from(professionalInTelerady).where(eq(professionalInTelerady.email, email)).execute();
        return userProfessional.length > 0;
    }

    async getTitleSpecialtyById(db: DBOrTx, titleStatusId: number) {
        const titleSpecialties = await db
            .select({ id: getTitleSpecialty.id })
            .from(getTitleSpecialty)
            .where(eq(getTitleSpecialty.id, titleStatusId))
            .execute();
        return titleSpecialties.length > 0 ? titleSpecialties[0] : null;
    }

    async getPersonalDataByEmail(db: DBOrTx, email: string) {
        const personalData = await db
            .select({ id: professionalInTelerady.id })
            .from(professionalInTelerady)
            .where(eq(sql`LOWER(${professionalInTelerady.email})`, email.toLowerCase()))
            .execute();
        return personalData.length > 0 ? personalData[0] : null;
    }

    async updatePersonalData(db: DBOrTx, idProfessional: string, data: SaveProfessionalDto) {
        await db.update(professionalInTelerady)
            .set({
                name: data.name,
                lastName: data.lastName,
                phone: data.phone,
                cityResidence: data.cityResidence,
                titleStatusId: data.titleStatusId,
                professionalLicense: data.professionalLicense,
            })
            .where(eq(professionalInTelerady.id, idProfessional))
            .execute();
    }

    async savePersonalData(db: DBOrTx, data: SaveProfessionalDto) {
        const inserted = await db.insert(professionalInTelerady)
            .values({
                name: data.name,
                lastName: data.lastName,
                phone: data.phone,
                email: data.email,
                cityResidence: data.cityResidence,
                titleStatusId: data.titleStatusId,
                professionalLicense: data.professionalLicense,
            })
            .returning({ id: professionalInTelerady.id })
            .execute();

        return inserted[0].id;
    }

    async saveSubspecialties(db: DBOrTx, idProfessional: string, subspecialtiesData: number[] = []) {
        await db.delete(professionalSubspecialtyInTelerady).where(eq(professionalSubspecialtyInTelerady.professionalId, idProfessional))
            .execute();
        if (subspecialtiesData.length > 0) {
            const subspecialties = subspecialtiesData.map(subspecialtyId => ({
                professionalId: idProfessional,
                subspecialtyId: subspecialtyId
            }));
            await db.insert(professionalSubspecialtyInTelerady)
                .values(subspecialties)
                .execute();
        }
    }

    async saveOrUpdateProfessionalDocument(db: DBOrTx, professionalId: string, documentId: number, nameDocument: string, driveId: string,) {
        const whereClause = and(
            eq(professionalDocumentInTelerady.professionalId, professionalId),
            eq(professionalDocumentInTelerady.documentId, documentId)
        )
        const existing = await db.select().from(professionalDocumentInTelerady).where(whereClause).execute();
        if (existing.length > 0) {
            await db.update(professionalDocumentInTelerady)
                .set({ nameDocument, driveId, }).where(whereClause).execute();
        } else {
            await db.insert(professionalDocumentInTelerady).values({ professionalId, documentId, nameDocument, driveId, }).execute();
        }
    }

    async getUploadedDocument(db: DBOrTx, professionalId: string, documentId: number) {
        const documents = await db
            .select()
            .from(professionalDocumentInTelerady)
            .where(
                and(
                    eq(professionalDocumentInTelerady.professionalId, professionalId),
                    eq(professionalDocumentInTelerady.documentId, documentId)
                )
            ).execute();
        return documents.length > 0 ? documents[0] : null;
    }

    async uploadDocument(db: DBOrTx, data: { professionalId: string, documentId: number, nameDocument: string, driveId: string }) {
        await db
            .update(professionalDocumentInTelerady)
            .set({ nameDocument: data.nameDocument, driveId: data.driveId })
            .where(
                and(
                    eq(professionalDocumentInTelerady.professionalId, data.professionalId),
                    eq(professionalDocumentInTelerady.documentId, data.documentId)
                )
            )
            .execute();
    }

    async insertDocument(db: DBOrTx, data: { professionalId: string, documentId: number, nameDocument: string, driveId: string }) {
        await db.insert(professionalDocumentInTelerady).values({
            professionalId: data.professionalId,
            documentId: data.documentId,
            nameDocument: data.nameDocument,
            driveId: data.driveId,
        }).execute();
    }
}