import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InternalServerErrorException } from '@nestjs/common';
import { GetUploadedDocumentsQuery } from '../queries/get-uploaded-documents.query';
import { ProfessionalDocumentRepository } from '../repositories/professional-document.repository';
import { GetUploadedDocumentsResponse } from '../models/get-upload-document.entity';
import { I18nService } from '../../../i18n/i18n.service';
import { db } from '../../../database/drizzle';
import { StorageService } from '../../../integrations/storage/storage.service';

const SIGNED_URL_TTL_SECONDS = 300;

@QueryHandler(GetUploadedDocumentsQuery)
export class GetUploadedDocumentsHandler implements IQueryHandler<GetUploadedDocumentsQuery> {
  constructor(
    private readonly repository: ProfessionalDocumentRepository,
    private readonly storage: StorageService,
    private readonly i18n: I18nService,
  ) {}

  async execute(query: GetUploadedDocumentsQuery): Promise<GetUploadedDocumentsResponse> {
    try {
      const user = await this.repository.getPersonalDataByEmail(db, query.email);
      if (!user) {
        return {
          ok: false,
          message: this.i18n.translate('professionalDocument.getUploadDocument.errorMessage'),
          response: [],
        };
      }

      const documents = await this.repository.getUploadedDocuments(db, user.id);
      const response = await Promise.all(
        documents.map(async (d) => ({
          documentTypeId: d.documentTypeId,
          // `driveId` is kept as the field name for backwards compatibility
          // with the SPA. New uploads expose a short-lived signed URL; legacy
          // rows still on Drive return the original drive_id as a fallback so
          // the SPA can let Sprint 4 redesign the page cleanly.
          driveId: d.storageKey
            ? await this.storage.signedGetUrl(d.storageKey, 'documents', SIGNED_URL_TTL_SECONDS)
            : d.driveId ?? '',
        })),
      );
      return { ok: true, message: '', response };
    } catch (err) {
      console.error('GetUploadedDocumentsHandler', err);
      throw new InternalServerErrorException(
        this.i18n.translate('professionalDocument.getUploadDocument.errorMessage'),
      );
    }
  }
}
