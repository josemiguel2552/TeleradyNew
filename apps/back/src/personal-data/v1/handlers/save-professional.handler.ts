import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { SaveProfessionalResponse } from "../models/save-professional.entity";
import { InternalServerErrorException } from "@nestjs/common";
import { I18nService } from "../../../i18n/i18n.service";
import { PersonalDataRepository } from "../repositories/personal-data.repository";
import { db } from "../../../database/drizzle";
import { SaveProfessionalCommand } from "../commands/save-professional.command";
import { SaveProfessionalDto } from "../models/save-professional.dto";
import { DriveService } from "../../../integrations/google/drive.service";
import path from "path";
import { OtherDocumentDto } from "../models/other-document.dto";
import { extImagen, fileNameMap, mimeTypeDoc } from "../../../common/constants/document.constant";

@CommandHandler(SaveProfessionalCommand)
export class SaveProfessionalHandler implements ICommandHandler<SaveProfessionalCommand> {
  constructor(
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly driveService: DriveService,
    private readonly i18n: I18nService,
  ) { }

  async execute(query: SaveProfessionalCommand): Promise<SaveProfessionalResponse> {
    try {
      const data: SaveProfessionalDto = query.data;
      return await db.transaction(async (tx) => {
        const titleSpecialty = await this.personalDataRepository.getTitleSpecialtyById(tx, data.titleStatusId);
        if (!titleSpecialty)
          return { ok: false, message: this.i18n.translate('personalData.validateProfessional.notValid'), response: undefined };

        const personalData = await this.personalDataRepository.getPersonalDataByEmail(tx, data.email);
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
          if (!!extension) {
            const drive = await this.saveFile(file, `${data.name}_${data.lastName}`, data.professionalLicense, extension);
            const document = await this.personalDataRepository.getUploadedDocument(tx, idProfessional, file.documentTypeId);
            if (document)
              await this.personalDataRepository.uploadDocument(tx, { documentId: file.documentTypeId, driveId: drive.driveId, nameDocument: drive.normalizedName, professionalId: idProfessional });
            else
              await this.personalDataRepository.insertDocument(tx, { documentId: file.documentTypeId, driveId: drive.driveId, nameDocument: drive.normalizedName, professionalId: idProfessional });
          }
        }
        return {
          ok: true,
          message: personalData ? this.i18n.translate('personalData.validateProfessional.update') : this.i18n.translate('personalData.validateProfessional.save'),
          response: { id: idProfessional },
        };
      });
    } catch (err) {
      console.error('SaveProfessionalHandler', err);
      throw new InternalServerErrorException(
        this.i18n.translate('personalData.validateProfessional.errorMessage')
      );
    }
  }

  private async saveFile(data: OtherDocumentDto, name: string, license: string, extension: string): Promise<{ driveId: string, normalizedName: string }> {
    const folderName = `${name}`.replace(/\s+/g, '') + `_${license}`;
    const parentFolderId = process.env.FOLDER_TELERADY_DOC_ID!;
    const userFolderId = await this.driveService.getIdFolder(folderName, parentFolderId);
    const normalizedName = this.getNormalizedName(license, data.documentTypeId, extension);

    if (extImagen.includes(extension))
      await this.deleteAllSignatureFiles(normalizedName, userFolderId);

    const mimeType = mimeTypeDoc[extension] ?? '';

    const buffer = Buffer.from(data.fileBase64, "base64");
    const fileRes = await this.driveService.saveFile(
      { name: normalizedName, mimeType, data: buffer },
      userFolderId
    );

    return { driveId: fileRes.id, normalizedName };
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

  private async deleteAllSignatureFiles(nameFile: string, folderId: string): Promise<void> {
    const files = await this.driveService.listFilesInFolder(folderId);
    const baseName = path.basename(nameFile, path.extname(nameFile));
    const matches = files.filter(file => file.name === `${baseName}.jpg` || file.name === `${baseName}.jpeg` || file.name === `${baseName}.png`);
    for (const file of matches) {
      await this.driveService.deleteFile(file.id);
    }
  }
}
