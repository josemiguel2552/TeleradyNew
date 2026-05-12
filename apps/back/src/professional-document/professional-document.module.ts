import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProfessionalDocumentController } from './v1/controllers/professional-document.controller';
import { UploadDocumentHandler } from './v1/handlers/upload-document.handler';
import { ProfessionalDocumentRepository } from './v1/repositories/professional-document.repository';
import { ProfessionalDocumentService } from './v1/services/professional-document.service';
import { GetUploadedDocumentsHandler } from './v1/handlers/get-uploaded-documents.handler';

@Module({
  imports: [CqrsModule],
  controllers: [ProfessionalDocumentController],
  providers: [
    UploadDocumentHandler,
    GetUploadedDocumentsHandler,
    ProfessionalDocumentService,
    ProfessionalDocumentRepository,
  ],
})
export class ProfessionalDocumentModule {}
