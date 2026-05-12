import { Injectable } from "@nestjs/common";
import { DBOrTx } from "../../../database/drizzle";
import { professionalInTelerady, professionalDocumentInTelerady } from "../../../database/schema";
import { eq, and, sql } from "drizzle-orm";

@Injectable()
export class ProfessionalDocumentRepository {

  async getPersonalDataByEmail(db: DBOrTx, email: string) {
    const personalData = await db
      .select()
      .from(professionalInTelerady)
      .where(eq(sql`LOWER(${professionalInTelerady.email})`, email.toLowerCase()))
      .execute();
    return personalData.length > 0 ? personalData[0] : null;
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

  async getUploadedDocuments(db: DBOrTx, professionalId: string) {
    return await db
      .select({
        documentTypeId: professionalDocumentInTelerady.documentId,
        driveId: professionalDocumentInTelerady.driveId
      })
      .from(professionalDocumentInTelerady)
      .where(eq(professionalDocumentInTelerady.professionalId, professionalId))
      .execute();
  }
}
