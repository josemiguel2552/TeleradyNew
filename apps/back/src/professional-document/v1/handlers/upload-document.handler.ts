import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InternalServerErrorException } from '@nestjs/common';
import path from 'path';
import { UploadDocumentCommand } from '../commands/upload-document.command';
import { UploadDocument } from '../models/upload-document.dto';
import { UploadDocumentResponse } from '../models/upload-document.entity';
import { db } from '../../../database/drizzle';
import { I18nService } from '../../../i18n/i18n.service';
import { ProfessionalDocumentRepository } from '../repositories/professional-document.repository';
import { StorageService } from '../../../integrations/storage/storage.service';
import {
  extImagen,
  fileNameMap,
  mimeTypeDoc,
} from '../../../common/constants/document.constant';

@CommandHandler(UploadDocumentCommand)
export class UploadDocumentHandler implements ICommandHandler<UploadDocumentCommand> {
  constructor(
    private readonly repository: ProfessionalDocumentRepository,
    private readonly storage: StorageService,
    private readonly i18n: I18nService,
  ) {}

  async execute(command: UploadDocumentCommand): Promise<UploadDocumentResponse> {
    try {
      const data = command.data;
      const extension = this.getExt(data.fileName, data.documentTypeId);
      if (!extension) {
        return {
          ok: false,
          message: this.i18n.translate('professionalDocument.uploadDocument.errorExt'),
          response: undefined,
        };
      }

      return await db.transaction(async (tx) => {
        const user = await this.repository.getPersonalDataByEmail(tx, data.email);
        if (!user) {
          return {
            ok: false,
            message: this.i18n.translate('professionalDocument.uploadDocument.errorMessage'),
            response: undefined,
          };
        }

        const stored = await this.saveFile(data, user.id, user.professionalLicense ?? '', extension);
        const document = await this.repository.getUploadedDocument(tx, user.id, data.documentTypeId);
        if (document) {
          await this.repository.uploadDocument(tx, {
            professionalId: user.id,
            documentId: data.documentTypeId,
            nameDocument: stored.normalizedName,
            storageBucket: stored.bucket,
            storageKey: stored.key,
          });
        } else {
          await this.repository.insertDocument(tx, {
            professionalId: user.id,
            documentId: data.documentTypeId,
            nameDocument: stored.normalizedName,
            storageBucket: stored.bucket,
            storageKey: stored.key,
          });
        }

        return { ok: true, message: '', response: { driveId: stored.key } };
      });
    } catch (err) {
      console.error('UploadDocumentHandler', err);
      throw new InternalServerErrorException(
        this.i18n.translate('professionalDocument.uploadDocument.errorMessage'),
      );
    }
  }

  private async saveFile(
    data: UploadDocument,
    professionalId: string,
    license: string,
    extension: string,
  ): Promise<{ bucket: string; key: string; normalizedName: string }> {
    const normalizedName = this.getNormalizedName(license, data.documentTypeId, extension);
    const key = `professionals/${professionalId}/${data.documentTypeId}/${normalizedName}`;
    const mimeType = mimeTypeDoc[extension] ?? 'application/octet-stream';
    const buffer = Buffer.from(data.fileBase64, 'base64');

    const result = await this.storage.put({
      key,
      body: buffer,
      contentType: mimeType,
      bucket: 'documents',
      metadata: {
        professionalId,
        documentTypeId: String(data.documentTypeId),
      },
    });

    return { bucket: result.bucket, key: result.key, normalizedName };
  }

  private getExt(fileName: string, documentTypeId: number): string {
    const extension = path.extname(fileName).toLowerCase();
    const isImage = extImagen.includes(extension);
    const isPdf = extension === '.pdf';
    if ((documentTypeId === 7 && isImage) || (isPdf && documentTypeId !== 7)) {
      return extension;
    }
    return '';
  }

  private getNormalizedName(license: string, documentTypeId: number, extension: string): string {
    const nameMap = fileNameMap[documentTypeId] ? fileNameMap[documentTypeId] + license : undefined;
    return `${nameMap || `documento-${documentTypeId}`}${extension}`;
  }
}
