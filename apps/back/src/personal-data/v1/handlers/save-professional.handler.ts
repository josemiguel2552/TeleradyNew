import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InternalServerErrorException } from '@nestjs/common';
import path from 'path';
import { SaveProfessionalResponse } from '../models/save-professional.entity';
import { I18nService } from '../../../i18n/i18n.service';
import { PersonalDataRepository } from '../repositories/personal-data.repository';
import { db } from '../../../database/drizzle';
import { SaveProfessionalCommand } from '../commands/save-professional.command';
import { SaveProfessionalDto } from '../models/save-professional.dto';
import { StorageService } from '../../../integrations/storage/storage.service';
import { OtherDocumentDto } from '../models/other-document.dto';
import {
  extImagen,
  fileNameMap,
  mimeTypeDoc,
} from '../../../common/constants/document.constant';

@CommandHandler(SaveProfessionalCommand)
export class SaveProfessionalHandler implements ICommandHandler<SaveProfessionalCommand> {
  constructor(
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly storage: StorageService,
    private readonly i18n: I18nService,
  ) {}

  async execute(query: SaveProfessionalCommand): Promise<SaveProfessionalResponse> {
    try {
      const data: SaveProfessionalDto = query.data;
      return await db.transaction(async (tx) => {
        const titleSpecialty = await this.personalDataRepository.getTitleSpecialtyById(
          tx,
          data.titleStatusId,
        );
        if (!titleSpecialty) {
          return {
            ok: false,
            message: this.i18n.translate('personalData.validateProfessional.notValid'),
            response: undefined,
          };
        }

        const personalData = await this.personalDataRepository.getPersonalDataByEmail(
          tx,
          data.email,
        );
        let idProfessional: string;
        if (personalData) {
          idProfessional = personalData.id;
          await this.personalDataRepository.updatePersonalData(tx, idProfessional, data);
          await this.personalDataRepository.saveSubspecialties(tx, idProfessional, data.subspecialties);
        } else {
          idProfessional = await this.personalDataRepository.savePersonalData(tx, data);
          await this.personalDataRepository.saveSubspecialties(tx, idProfessional, data.subspecialties);
        }

        if (data.otherDocuments && data.otherDocuments.length > 0) {
          const file = data.otherDocuments[0];
          const extension = this.getExt(file.fileName, file.documentTypeId);
          if (extension) {
            const stored = await this.saveFile(
              file,
              idProfessional,
              data.professionalLicense,
              extension,
            );
            const document = await this.personalDataRepository.getUploadedDocument(
              tx,
              idProfessional,
              file.documentTypeId,
            );
            const payload = {
              documentId: file.documentTypeId,
              storageBucket: stored.bucket,
              storageKey: stored.key,
              nameDocument: stored.normalizedName,
              professionalId: idProfessional,
            };
            if (document) {
              await this.personalDataRepository.uploadDocument(tx, payload);
            } else {
              await this.personalDataRepository.insertDocument(tx, payload);
            }
          }
        }
        return {
          ok: true,
          message: personalData
            ? this.i18n.translate('personalData.validateProfessional.update')
            : this.i18n.translate('personalData.validateProfessional.save'),
          response: { id: idProfessional },
        };
      });
    } catch (err) {
      console.error('SaveProfessionalHandler', err);
      throw new InternalServerErrorException(
        this.i18n.translate('personalData.validateProfessional.errorMessage'),
      );
    }
  }

  private async saveFile(
    data: OtherDocumentDto,
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
      metadata: { professionalId, documentTypeId: String(data.documentTypeId) },
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
