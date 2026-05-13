import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { SaveProfessionalHandler } from '../save-professional.handler';
import { SaveProfessionalCommand } from '../../commands/save-professional.command';
import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { StorageService } from '../../../../integrations/storage/storage.service';
import { I18nService } from '../../../../i18n/i18n.service';
import { db } from '../../../../database/drizzle';

jest.mock('../../../../database/drizzle', () => ({
  db: { transaction: jest.fn() },
}));

describe('SaveProfessionalHandler', () => {
  let handler: SaveProfessionalHandler;
  let repositoryMock: Partial<PersonalDataRepository>;
  let storageMock: Partial<StorageService>;
  let i18nMock: Partial<I18nService>;

  const baseCommand = (overrides: Partial<any> = {}) =>
    new SaveProfessionalCommand({
      email: 'test@example.com',
      name: 'John',
      lastName: 'Doe',
      titleStatusId: 1,
      subspecialties: [],
      otherDocuments: [],
      phone: '+11 2232334',
      cityResidence: 'Madrid',
      professionalLicense: 'lic-1',
      ...overrides,
    });

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
    storageMock = {
      put: jest.fn().mockResolvedValue({ bucket: 'telerady-documents', key: 'key' }),
    };
    i18nMock = { translate: jest.fn().mockImplementation((key: string) => key) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveProfessionalHandler,
        { provide: PersonalDataRepository, useValue: repositoryMock },
        { provide: StorageService, useValue: storageMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    handler = module.get<SaveProfessionalHandler>(SaveProfessionalHandler);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('rejects unknown title statuses before touching anything', async () => {
    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockResolvedValue(null);
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));
    const result = await handler.execute(baseCommand());
    expect(result.ok).toBe(false);
    expect(storageMock.put).not.toHaveBeenCalled();
  });

  it('creates a new professional when the email is unknown', async () => {
    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockResolvedValue(true);
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(null);
    (repositoryMock.savePersonalData as jest.Mock).mockResolvedValue('new-id');
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    const result = await handler.execute(baseCommand());

    expect(repositoryMock.savePersonalData).toHaveBeenCalled();
    expect(result.response?.id).toBe('new-id');
    expect(result.message).toBe('personalData.validateProfessional.save');
  });

  it('uploads attached documents to S3 and inserts the row when none exists', async () => {
    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockResolvedValue(true);
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue({ id: 'prof-1' });
    (repositoryMock.getUploadedDocument as jest.Mock).mockResolvedValue(null);
    (storageMock.put as jest.Mock).mockResolvedValue({
      bucket: 'telerady-documents',
      key: 'professionals/prof-1/7/Signature_lic-1.png',
    });
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    await handler.execute(
      baseCommand({
        otherDocuments: [
          { fileName: 'signature.png', fileBase64: 'AAA=', documentTypeId: 7 },
        ],
      }),
    );

    expect(storageMock.put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'professionals/prof-1/7/Signature_lic-1.png',
        contentType: 'image/png',
      }),
    );
    expect(repositoryMock.insertDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        storageKey: 'professionals/prof-1/7/Signature_lic-1.png',
        storageBucket: 'telerady-documents',
      }),
    );
  });

  it('updates the row when the document already exists', async () => {
    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockResolvedValue(true);
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue({ id: 'prof-1' });
    (repositoryMock.getUploadedDocument as jest.Mock).mockResolvedValue({});
    (storageMock.put as jest.Mock).mockResolvedValue({
      bucket: 'telerady-documents',
      key: 'professionals/prof-1/7/Signature_lic-1.png',
    });
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    await handler.execute(
      baseCommand({
        otherDocuments: [
          { fileName: 'signature.png', fileBase64: 'AAA=', documentTypeId: 7 },
        ],
      }),
    );

    expect(repositoryMock.uploadDocument).toHaveBeenCalled();
    expect(repositoryMock.insertDocument).not.toHaveBeenCalled();
  });

  it('rethrows InternalServerErrorException on unexpected errors', async () => {
    (repositoryMock.getTitleSpecialtyById as jest.Mock).mockRejectedValue(new Error('boom'));
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    await expect(handler.execute(baseCommand())).rejects.toThrow(InternalServerErrorException);
    expect(i18nMock.translate).toHaveBeenCalledWith('personalData.validateProfessional.errorMessage');
  });
});
