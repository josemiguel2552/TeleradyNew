import { Test, TestingModule } from '@nestjs/testing';
import { UploadDocumentHandler } from '../upload-document.handler';
import { UploadDocumentCommand } from '../../commands/upload-document.command';
import { ProfessionalDocumentRepository } from '../../repositories/professional-document.repository';
import { DriveService } from '../../../../integrations/google/drive.service';
import { I18nService } from '../../../../i18n/i18n.service';
import { InternalServerErrorException } from '@nestjs/common';
import { db } from '../../../../database/drizzle';

jest.mock('../../../../database/drizzle', () => ({
  db: {
    transaction: jest.fn(),
  },
}));
describe('UploadDocumentHandler', () => {
  let handler: UploadDocumentHandler;
  let repositoryMock: Partial<ProfessionalDocumentRepository>;
  let driveServiceMock: Partial<DriveService>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    repositoryMock = {
      getPersonalDataByEmail: jest.fn(),
      getUploadedDocument: jest.fn(),
      uploadDocument: jest.fn(),
      insertDocument: jest.fn(),
    };

    driveServiceMock = {
      getIdFolder: jest.fn(),
      saveFile: jest.fn(),
      listFilesInFolder: jest.fn(),
      deleteFile: jest.fn(),
    };

    i18nServiceMock = {
      translate: jest.fn().mockImplementation((key: string) => key),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadDocumentHandler,
        { provide: ProfessionalDocumentRepository, useValue: repositoryMock },
        { provide: DriveService, useValue: driveServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compile();

    handler = module.get<UploadDocumentHandler>(UploadDocumentHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should return an error if the file extension is invalid', async () => {
      const command = new UploadDocumentCommand({
        email: 'test@example.com',
        fileName: 'invalid-file.txt',
        documentTypeId: 1,
        fileBase64: 'mock-base64',
      });

      (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return await callback({});
      });

      const result = await handler.execute(command);

      expect(result).toEqual({
        ok: false,
        message: 'professionalDocument.uploadDocument.errorExt',
        response: undefined,
      });
      expect(repositoryMock.getPersonalDataByEmail).not.toHaveBeenCalled();
    });

    it('should return an error if the user does not exist', async () => {
      const command = new UploadDocumentCommand({
        email: 'test@example.com',
        fileName: 'valid-file.pdf',
        documentTypeId: 1,
        fileBase64: 'mock-base64',
      });

      (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(null);
      (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return await callback({});
      });

      const result = await handler.execute(command);

      expect(repositoryMock.getPersonalDataByEmail).toHaveBeenCalledWith(expect.anything(), command.data.email);
      expect(result).toEqual({
        ok: false,
        message: 'professionalDocument.uploadDocument.errorMessage',
        response: undefined,
      });
    });

    it('should upload a document if the user exists and the file is valid', async () => {
      const command = new UploadDocumentCommand({
        email: 'test@example.com',
        fileName: 'valid-file.pdf',
        documentTypeId: 1,
        fileBase64: 'mock-base64',
      });

      const mockUser = { id: 1, name: 'John', lastName: 'Doe', professionalLicense: '12345' };
      const mockDriveResponse = { id: 'mock-drive-id', normalizedName: 'valid-file.pdf' };

      (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(mockUser);
      (driveServiceMock.getIdFolder as jest.Mock).mockResolvedValue('mock-folder-id');
      (driveServiceMock.saveFile as jest.Mock).mockResolvedValue(mockDriveResponse);
      (repositoryMock.getUploadedDocument as jest.Mock).mockResolvedValue(null);
      (repositoryMock.insertDocument as jest.Mock).mockResolvedValue(undefined);
      (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return await callback({});
      });

      const result = await handler.execute(command);

      expect(repositoryMock.getPersonalDataByEmail).toHaveBeenCalledWith(expect.anything(), command.data.email);
      expect(driveServiceMock.getIdFolder).toHaveBeenCalledWith(
        `${mockUser.name}_${mockUser.lastName}`.replace(/\s+/g, '') + `_${mockUser.professionalLicense}`,
        process.env.FOLDER_TELERADY_DOC_ID
      );
      expect(driveServiceMock.saveFile).toHaveBeenCalledWith(
        expect.anything(),
        'mock-folder-id'
      );
      expect(repositoryMock.insertDocument).toHaveBeenCalledWith(expect.anything(), {
        documentId: command.data.documentTypeId,
        driveId: mockDriveResponse.id,
        nameDocument: 'titulo-especialista_12345.pdf',
        professionalId: mockUser.id,
      });
      expect(result).toEqual({
        ok: true,
        message: '',
        response: { driveId: mockDriveResponse.id },
      });
    });

    it('should call uploadDocument if the document already exists and the file is a PNG', async () => {
      const command = new UploadDocumentCommand({
        email: 'test@example.com',
        fileName: 'signature.png',
        documentTypeId: 7,
        fileBase64: 'mock-base64',
      });

      const mockUser = { id: 1, name: 'John', lastName: 'Doe', professionalLicense: '12345' };
      const mockDriveResponse = { id: 'mock-drive-id', normalizedName: 'Signature_12345.png' };
      const mockExistingDocument = { documentTypeId: 7, driveId: 'existing-drive-id' };

      (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(mockUser);
      (driveServiceMock.getIdFolder as jest.Mock).mockResolvedValue('mock-folder-id');
      (driveServiceMock.saveFile as jest.Mock).mockResolvedValue(mockDriveResponse);
      (driveServiceMock.listFilesInFolder as jest.Mock).mockResolvedValue([{ id: 'id-mock-file', name: 'Signature_12345.png' }]);
      (driveServiceMock.deleteFile as jest.Mock).mockResolvedValue({});
      (repositoryMock.getUploadedDocument as jest.Mock).mockResolvedValue(mockExistingDocument);
      (repositoryMock.uploadDocument as jest.Mock).mockResolvedValue(undefined);
      (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return await callback({});
      });

      const result = await handler.execute(command);

      expect(repositoryMock.getPersonalDataByEmail).toHaveBeenCalledWith(expect.anything(), command.data.email);
      expect(driveServiceMock.getIdFolder).toHaveBeenCalledWith(
        `${mockUser.name}_${mockUser.lastName}`.replace(/\s+/g, '') + `_${mockUser.professionalLicense}`,
        process.env.FOLDER_TELERADY_DOC_ID
      );
      expect(driveServiceMock.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({ name: mockDriveResponse.normalizedName }),
        'mock-folder-id'
      );
      expect(driveServiceMock.listFilesInFolder).toHaveBeenCalledWith('mock-folder-id');
      expect(driveServiceMock.deleteFile).toHaveBeenCalledWith('id-mock-file');
      expect(driveServiceMock.deleteFile).toHaveBeenCalledTimes(1);
      expect(repositoryMock.uploadDocument).toHaveBeenCalledWith(expect.anything(), {
        documentId: command.data.documentTypeId,
        driveId: mockDriveResponse.id,
        nameDocument: mockDriveResponse.normalizedName,
        professionalId: mockUser.id,
      });
      expect(result).toEqual({
        ok: true,
        message: '',
        response: { driveId: mockDriveResponse.id },
      });
    });

    it('should throw an InternalServerErrorException if an error occurs', async () => {
      const command = new UploadDocumentCommand({
        email: 'test@example.com',
        fileName: 'valid-file.pdf',
        documentTypeId: 1,
        fileBase64: 'mock-base64',
      });

      (repositoryMock.getPersonalDataByEmail as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(handler.execute(command)).rejects.toThrow(InternalServerErrorException);

      expect(repositoryMock.getPersonalDataByEmail).toHaveBeenCalledWith(expect.anything(), command.data.email);
      expect(i18nServiceMock.translate).toHaveBeenCalledWith('professionalDocument.uploadDocument.errorMessage');
    });
  })
});
