import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUploadedDocumentsQuery } from '../queries/get-uploaded-documents.query';
import { ProfessionalDocumentRepository } from '../repositories/professional-document.repository';
import { GetUploadedDocumentsResponse, UploadedDocument } from '../models/get-upload-document.entity';
import { InternalServerErrorException } from '@nestjs/common';
import { I18nService } from '../../../i18n/i18n.service';
import { db } from '../../../database/drizzle';

@QueryHandler(GetUploadedDocumentsQuery)
export class GetUploadedDocumentsHandler implements IQueryHandler<GetUploadedDocumentsQuery> {
  constructor(private readonly repository: ProfessionalDocumentRepository, private readonly i18n: I18nService,) { }

  async execute(query: GetUploadedDocumentsQuery): Promise<GetUploadedDocumentsResponse> {
    try {
      const user = await this.repository.getPersonalDataByEmail(db, query.email);
      if (!user)
        return { ok: false, message: this.i18n.translate("professionalDocument.getUploadDocument.errorMessage"), response: [] };
      
      const documents = await this.repository.getUploadedDocuments(db, user.id);
      return { ok: true, message: '', response: documents.map(d => ({ documentTypeId: d.documentTypeId, driveId: d.driveId ?? '' })) };
    } catch (err) {
      console.error('GetUploadedDocumentsHandler', err);
      throw new InternalServerErrorException(this.i18n.translate("professionalDocument.getUploadDocument.errorMessage"));
    }
  }
}
