import { Injectable } from '@nestjs/common';
import { DBOrTx } from '../../../database/drizzle';
import { professionalInTelerady, professionalDocumentInTelerady } from '../../../database/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface UploadedDocumentRow {
  documentTypeId: number;
  driveId: string | null;
  storageBucket: string | null;
  storageKey: string | null;
  nameDocument: string | null;
}

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
          eq(professionalDocumentInTelerady.documentId, documentId),
        ),
      )
      .execute();
    return documents.length > 0 ? documents[0] : null;
  }

  async uploadDocument(
    db: DBOrTx,
    data: {
      professionalId: string;
      documentId: number;
      nameDocument: string;
      storageBucket: string;
      storageKey: string;
    },
  ) {
    await db
      .update(professionalDocumentInTelerady)
      .set({
        nameDocument: data.nameDocument,
        storageBucket: data.storageBucket,
        storageKey: data.storageKey,
        driveId: null,
      })
      .where(
        and(
          eq(professionalDocumentInTelerady.professionalId, data.professionalId),
          eq(professionalDocumentInTelerady.documentId, data.documentId),
        ),
      )
      .execute();
  }

  async insertDocument(
    db: DBOrTx,
    data: {
      professionalId: string;
      documentId: number;
      nameDocument: string;
      storageBucket: string;
      storageKey: string;
    },
  ) {
    await db
      .insert(professionalDocumentInTelerady)
      .values({
        professionalId: data.professionalId,
        documentId: data.documentId,
        nameDocument: data.nameDocument,
        storageBucket: data.storageBucket,
        storageKey: data.storageKey,
      })
      .execute();
  }

  async getUploadedDocuments(db: DBOrTx, professionalId: string): Promise<UploadedDocumentRow[]> {
    const rows = await db
      .select({
        documentTypeId: professionalDocumentInTelerady.documentId,
        driveId: professionalDocumentInTelerady.driveId,
        storageBucket: professionalDocumentInTelerady.storageBucket,
        storageKey: professionalDocumentInTelerady.storageKey,
        nameDocument: professionalDocumentInTelerady.nameDocument,
      })
      .from(professionalDocumentInTelerady)
      .where(eq(professionalDocumentInTelerady.professionalId, professionalId))
      .execute();
    return rows;
  }
}
