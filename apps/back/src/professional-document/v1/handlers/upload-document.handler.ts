import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { UploadDocumentCommand } from "../commands/upload-document.command";
import { UploadDocument } from "../models/upload-document.dto";
import { UploadDocumentResponse } from "../models/upload-document.entity";
import { db } from "../../../database/drizzle";
import { InternalServerErrorException } from "@nestjs/common";
import { I18nService } from '../../../i18n/i18n.service';
import { ProfessionalDocumentRepository } from "../repositories/professional-document.repository";
import { DriveService } from "../../../integrations/google/drive.service";
import path from "path";
import { extImagen, fileNameMap, mimeTypeDoc } from "../../../common/constants/document.constant";

@CommandHandler(UploadDocumentCommand)
export class UploadDocumentHandler implements ICommandHandler<UploadDocumentCommand> {

  constructor(private readonly repository: ProfessionalDocumentRepository, private readonly driveService: DriveService, private readonly i18n: I18nService,) { }

  async execute(command: UploadDocumentCommand): Promise<UploadDocumentResponse> {
    try {
      const data = command.data;
      const extension = this.getExt(data.fileName, data.documentTypeId);
      if (!(!!extension))
        return { ok: false, message: this.i18n.translate("professionalDocument.uploadDocument.errorExt"), response: undefined };

      return await db.transaction(async (tx) => {
        const user = await this.repository.getPersonalDataByEmail(tx, data.email);
        if (!user)
          return { ok: false, message: this.i18n.translate("professionalDocument.uploadDocument.errorMessage"), response: undefined };

        const drive = await this.saveFile(data, `${user.name}_${user.lastName}`, user.professionalLicense ?? '', extension);
        const document = await this.repository.getUploadedDocument(tx, user.id, data.documentTypeId);
        if (document)
          await this.repository.uploadDocument(tx, { documentId: data.documentTypeId, driveId: drive.driveId, nameDocument: drive.normalizedName, professionalId: user.id });
        else
          await this.repository.insertDocument(tx, { documentId: data.documentTypeId, driveId: drive.driveId, nameDocument: drive.normalizedName, professionalId: user.id });

        return { ok: true, message: '', response: { driveId: drive.driveId } };
      });
    } catch (err) {
      console.error('UploadDocumentHandler', err);
      throw new InternalServerErrorException(this.i18n.translate("professionalDocument.uploadDocument.errorMessage"));
    }
  }

  private async saveFile(data: UploadDocument, name: string, license: string, extension: string): Promise<{ driveId: string, normalizedName: string }> {
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
