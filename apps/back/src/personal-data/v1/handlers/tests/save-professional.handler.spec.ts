import { Test, TestingModule } from '@nestjs/testing';
import { SaveProfessionalHandler } from '../save-professional.handler';
import { SaveProfessionalCommand } from '../../commands/save-professional.command';
import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { DriveService } from '../../../../integrations/google/drive.service';
import { I18nService } from '../../../../i18n/i18n.service';
import { InternalServerErrorException } from '@nestjs/common';
import { db } from '../../../../database/drizzle';

jest.mock('../../../../database/drizzle', () => ({
  db: {
    transaction: jest.fn(),
  },
}));
describe('SaveProfessionalHandler', () => {
  let handler: SaveProfessionalHandler;
  let repositoryMock: Partial<PersonalDataRepository>;
  let driveServiceMock: Partial<DriveService>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    repositoryMock = {
      getTitleSpecialtyById: jest.fn(),
      getPersonalDataByEmail: jest.fn(),
      updatePersonalData: jest.fn(),
      savePersonalData: jest.fn(),
      saveSubspecialties: jest.fn(),
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
      providers: [SaveProfessionalHandler,
        { provide: PersonalDataRepository, useValue: repositoryMock },
        { provide: DriveService, useValue: driveServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compile();

    handler = module.get<SaveProfessionalHandler>(SaveProfessionalHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.clearAllTimers();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should save new professional data if the user does not exist', async () => {
    const command = new SaveProfessionalCommand({
      email: 'test@example.com',
      name: 'John',
      lastName: 'Doe',
      titleStatusId: 1,
      subspecialties: [],
      otherDocuments: [],
      phone: '+11 2232334',
      cityResidence: 'city_mock',
      professionalLicense: 'license-mock'
    });

    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockResolvedValue(true);
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(null);
    (repositoryMock.savePersonalData as jest.Mock).mockResolvedValue('new-professional-id');
    (repositoryMock.saveSubspecialties as jest.Mock).mockResolvedValue(undefined);
    (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
      return await callback({});
    });

    const result = await handler.execute(command);

    expect(repositoryMock.getTitleSpecialtyById).toHaveBeenCalledWith(expect.anything(), command.data.titleStatusId);
    expect(repositoryMock.getPersonalDataByEmail).toHaveBeenCalledWith(expect.anything(), command.data.email);
    expect(repositoryMock.savePersonalData).toHaveBeenCalledWith(expect.anything(), command.data);
    expect(repositoryMock.saveSubspecialties).toHaveBeenCalledWith(expect.anything(), 'new-professional-id', command.data.subspecialties);
    expect(result).toEqual({
      ok: true,
      message: 'personalData.validateProfessional.save',
      response: { id: 'new-professional-id' },
    });
  });

  it('should update existing professional data if the user exists', async () => {
    const command = new SaveProfessionalCommand({
      email: 'test@example.com',
      name: 'John',
      lastName: 'Doe',
      titleStatusId: 1,
      subspecialties: [],
      otherDocuments: [],
      phone: '+11 2232334',
      cityResidence: 'city_mock',
      professionalLicense: 'license-mock'
    });

    const mockPersonalData = { id: 'existing-professional-id' };

    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockResolvedValue(true);
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(mockPersonalData);
    (repositoryMock.updatePersonalData as jest.Mock).mockResolvedValue(undefined);
    (repositoryMock.saveSubspecialties as jest.Mock).mockResolvedValue(undefined);
    (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
      return await callback({});
    });

    const result = await handler.execute(command);

    expect(repositoryMock.getTitleSpecialtyById).toHaveBeenCalledWith(expect.anything(), command.data.titleStatusId);
    expect(repositoryMock.getPersonalDataByEmail).toHaveBeenCalledWith(expect.anything(), command.data.email);
    expect(repositoryMock.updatePersonalData).toHaveBeenCalledWith(expect.anything(), 'existing-professional-id', command.data);
    expect(repositoryMock.saveSubspecialties).toHaveBeenCalledWith(expect.anything(), 'existing-professional-id', command.data.subspecialties);
    expect(result).toEqual({
      ok: true,
      message: 'personalData.validateProfessional.update',
      response: { id: 'existing-professional-id' },
    });
  });

  it('should handle PNG documents, insert in DB  and upload them to Google Drive', async () => {
    const command = new SaveProfessionalCommand({
      email: 'test@example.com',
      name: 'John',
      lastName: 'Doe',
      titleStatusId: 1,
      subspecialties: [],
      otherDocuments: [
        {
          fileName: 'signature.png',
          fileBase64: 'mock-base64',
          documentTypeId: 7,
        },
      ],
      phone: '+11 2232334',
      cityResidence: 'city_mock',
      professionalLicense: 'license-mock',
    });

    const mockPersonalData = { id: 'existing-professional-id' };
    const mockDriveResponse = { id: 'mock-drive-id', normalizedName: 'signature.png' };

    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockResolvedValue(true);
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(mockPersonalData);
    (driveServiceMock.getIdFolder as jest.Mock).mockResolvedValue('mock-folder-id');
    (driveServiceMock.saveFile as jest.Mock).mockResolvedValue(mockDriveResponse);
    (driveServiceMock.listFilesInFolder as jest.Mock).mockResolvedValue([{ id: 'id-mock-file', name: 'Signature_license-mock.png' }]);
    (driveServiceMock.deleteFile as jest.Mock).mockResolvedValue({});
    (repositoryMock.getUploadedDocument as jest.Mock).mockResolvedValue(null);
    (repositoryMock.insertDocument as jest.Mock).mockResolvedValue(undefined);
    (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
      return await callback({});
    });

    const result = await handler.execute(command);

    expect(driveServiceMock.getIdFolder).toHaveBeenCalledWith('John_Doe_license-mock', process.env.FOLDER_TELERADY_DOC_ID);
    expect(driveServiceMock.saveFile).toHaveBeenCalledWith(
      expect.anything(),
      'mock-folder-id',
    );
    expect(driveServiceMock.listFilesInFolder).toHaveBeenCalledWith('mock-folder-id');
    expect(driveServiceMock.deleteFile).toHaveBeenCalledWith('id-mock-file');
    expect(driveServiceMock.deleteFile).toHaveBeenCalledTimes(1);
    expect(repositoryMock.insertDocument).toHaveBeenCalledWith(expect.anything(), {
      documentId: 7,
      driveId: mockDriveResponse.id,
      nameDocument: 'Signature_license-mock.png',
      professionalId: 'existing-professional-id',
    });
    expect(result).toEqual({
      ok: true,
      message: 'personalData.validateProfessional.update',
      response: { id: 'existing-professional-id' },
    });
  });

  it('should handle PNG documents, upload in DB and upload them to Google Drive', async () => {
    const command = new SaveProfessionalCommand({
      email: 'test@example.com',
      name: 'John',
      lastName: 'Doe',
      titleStatusId: 1,
      subspecialties: [],
      otherDocuments: [
        {
          fileName: 'signature.png',
          fileBase64: 'mock-base64',
          documentTypeId: 7,
        },
      ],
      phone: '+11 2232334',
      cityResidence: 'city_mock',
      professionalLicense: 'license-mock',
    });

    const mockPersonalData = { id: 'existing-professional-id' };
    const mockDriveResponse = { id: 'mock-drive-id', normalizedName: 'signature.png' };

    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockResolvedValue(true);
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(mockPersonalData);
    (driveServiceMock.getIdFolder as jest.Mock).mockResolvedValue('mock-folder-id');
    (driveServiceMock.saveFile as jest.Mock).mockResolvedValue(mockDriveResponse);
    (driveServiceMock.listFilesInFolder as jest.Mock).mockResolvedValue([{ id: 'id-mock-file', name: 'Signature_license-mock.png' }]);
    (driveServiceMock.deleteFile as jest.Mock).mockResolvedValue({});
    (repositoryMock.getUploadedDocument as jest.Mock).mockResolvedValue({ id: 'id-mock-file' });
    (repositoryMock.uploadDocument as jest.Mock).mockResolvedValue(undefined);
    (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
      return await callback({});
    });

    const result = await handler.execute(command);

    expect(driveServiceMock.getIdFolder).toHaveBeenCalledWith('John_Doe_license-mock', process.env.FOLDER_TELERADY_DOC_ID);
    expect(driveServiceMock.saveFile).toHaveBeenCalledWith(
      expect.anything(),
      'mock-folder-id',
    );
    expect(driveServiceMock.listFilesInFolder).toHaveBeenCalledWith('mock-folder-id');
    expect(driveServiceMock.deleteFile).toHaveBeenCalledWith('id-mock-file');
    expect(driveServiceMock.deleteFile).toHaveBeenCalledTimes(1);
    expect(repositoryMock.uploadDocument).toHaveBeenCalledWith(expect.anything(), {
      documentId: 7,
      driveId: mockDriveResponse.id,
      nameDocument: 'Signature_license-mock.png',
      professionalId: 'existing-professional-id',
    });
    expect(result).toEqual({
      ok: true,
      message: 'personalData.validateProfessional.update',
      response: { id: 'existing-professional-id' },
    });
  });

  it('should throw an InternalServerErrorException if an error occurs', async () => {
    const command = new SaveProfessionalCommand({
      email: 'test@example.com',
      name: 'John',
      lastName: 'Doe',
      titleStatusId: 1,
      subspecialties: [],
      otherDocuments: [],
      phone: '+11 2232334',
      cityResidence: 'city_mock',
      professionalLicense: 'license-mock'
    });

    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockRejectedValue(new Error('Database error'));

    await expect(handler.execute(command)).rejects.toThrow(InternalServerErrorException);

    expect(repositoryMock.getTitleSpecialtyById).toHaveBeenCalledWith(expect.anything(), command.data.titleStatusId);
    expect(i18nServiceMock.translate).toHaveBeenCalledWith('personalData.validateProfessional.errorMessage');
  });
});