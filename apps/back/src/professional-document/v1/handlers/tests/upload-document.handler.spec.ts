import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { UploadDocumentHandler } from '../upload-document.handler';
import { UploadDocumentCommand } from '../../commands/upload-document.command';
import { ProfessionalDocumentRepository } from '../../repositories/professional-document.repository';
import { StorageService } from '../../../../integrations/storage/storage.service';
import { I18nService } from '../../../../i18n/i18n.service';
import { db } from '../../../../database/drizzle';

jest.mock('../../../../database/drizzle', () => ({
  db: { transaction: jest.fn() },
}));

describe('UploadDocumentHandler', () => {
  let handler: UploadDocumentHandler;
  let repositoryMock: Partial<ProfessionalDocumentRepository>;
  let storageMock: Partial<StorageService>;
  let i18nMock: Partial<I18nService>;

  beforeEach(async () => {
    repositoryMock = {
      getPersonalDataByEmail: jest.fn(),
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
        UploadDocumentHandler,
        { provide: ProfessionalDocumentRepository, useValue: repositoryMock },
        { provide: StorageService, useValue: storageMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    handler = module.get<UploadDocumentHandler>(UploadDocumentHandler);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('rejects unsupported file extensions before touching the DB', async () => {
    const command = new UploadDocumentCommand({
      email: 'a@b.es',
      fileName: 'invalid.txt',
      documentTypeId: 1,
      fileBase64: 'AAA=',
    });
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    const result = await handler.execute(command);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('professionalDocument.uploadDocument.errorExt');
    expect(repositoryMock.getPersonalDataByEmail).not.toHaveBeenCalled();
    expect(storageMock.put).not.toHaveBeenCalled();
  });

  it('returns an error when the user does not exist', async () => {
    const command = new UploadDocumentCommand({
      email: 'unknown@b.es',
      fileName: 'valid.pdf',
      documentTypeId: 1,
      fileBase64: 'AAA=',
    });
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(null);
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    const result = await handler.execute(command);

    expect(result.ok).toBe(false);
    expect(storageMock.put).not.toHaveBeenCalled();
  });

  it('uploads to S3 and inserts a new document row when none exists', async () => {
    const command = new UploadDocumentCommand({
      email: 'a@b.es',
      fileName: 'valid.pdf',
      documentTypeId: 1,
      fileBase64: 'AAA=',
    });
    const user = { id: 'prof-1', professionalLicense: '12345' };
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(user);
    (repositoryMock.getUploadedDocument as jest.Mock).mockResolvedValue(null);
    (storageMock.put as jest.Mock).mockResolvedValue({
      bucket: 'telerady-documents',
      key: 'professionals/prof-1/1/titulo-especialista_12345.pdf',
    });
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    const result = await handler.execute(command);

    expect(storageMock.put).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'documents',
        contentType: 'application/pdf',
        key: 'professionals/prof-1/1/titulo-especialista_12345.pdf',
      }),
    );
    expect(repositoryMock.insertDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        professionalId: 'prof-1',
        documentId: 1,
        storageBucket: 'telerady-documents',
        storageKey: 'professionals/prof-1/1/titulo-especialista_12345.pdf',
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('updates the row when the document already exists', async () => {
    const command = new UploadDocumentCommand({
      email: 'a@b.es',
      fileName: 'signature.png',
      documentTypeId: 7,
      fileBase64: 'AAA=',
    });
    const user = { id: 'prof-1', professionalLicense: '12345' };
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(user);
    (repositoryMock.getUploadedDocument as jest.Mock).mockResolvedValue({});
    (storageMock.put as jest.Mock).mockResolvedValue({
      bucket: 'telerady-documents',
      key: 'professionals/prof-1/7/firma_12345.png',
    });
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    await handler.execute(command);

    expect(repositoryMock.uploadDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ storageKey: 'professionals/prof-1/7/firma_12345.png' }),
    );
    expect(repositoryMock.insertDocument).not.toHaveBeenCalled();
  });

  it('translates and rethrows on unexpected errors', async () => {
    const command = new UploadDocumentCommand({
      email: 'a@b.es',
      fileName: 'valid.pdf',
      documentTypeId: 1,
      fileBase64: 'AAA=',
    });
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockRejectedValue(new Error('boom'));
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    await expect(handler.execute(command)).rejects.toThrow(InternalServerErrorException);
    expect(i18nMock.translate).toHaveBeenCalledWith(
      'professionalDocument.uploadDocument.errorMessage',
    );
  });
});
