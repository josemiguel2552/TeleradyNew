import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { GetUploadedDocumentsHandler } from '../get-uploaded-documents.handler';
import { ProfessionalDocumentRepository } from '../../repositories/professional-document.repository';
import { StorageService } from '../../../../integrations/storage/storage.service';
import { I18nService } from '../../../../i18n/i18n.service';
import { GetUploadedDocumentsQuery } from '../../queries/get-uploaded-documents.query';

describe('GetUploadedDocumentsHandler', () => {
  let handler: GetUploadedDocumentsHandler;
  let repositoryMock: Partial<ProfessionalDocumentRepository>;
  let storageMock: Partial<StorageService>;
  let i18nMock: Partial<I18nService>;

  beforeEach(async () => {
    repositoryMock = {
      getPersonalDataByEmail: jest.fn(),
      getUploadedDocuments: jest.fn(),
    };
    storageMock = {
      signedGetUrl: jest.fn().mockResolvedValue('https://s3.example/signed?ttl=300'),
    };
    i18nMock = { translate: jest.fn().mockImplementation((key: string) => key) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUploadedDocumentsHandler,
        { provide: ProfessionalDocumentRepository, useValue: repositoryMock },
        { provide: StorageService, useValue: storageMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    handler = module.get<GetUploadedDocumentsHandler>(GetUploadedDocumentsHandler);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('returns signed URLs for S3 rows and falls back to drive_id for legacy rows', async () => {
    const query = new GetUploadedDocumentsQuery('test@example.com');
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue({ id: 'p-1' });
    (repositoryMock.getUploadedDocuments as jest.Mock).mockResolvedValue([
      {
        documentTypeId: 1,
        driveId: null,
        storageBucket: 'telerady-documents',
        storageKey: 'professionals/p-1/1/titulo.pdf',
        nameDocument: 'titulo.pdf',
      },
      {
        documentTypeId: 7,
        driveId: 'legacy-drive-id',
        storageBucket: null,
        storageKey: null,
        nameDocument: 'firma.png',
      },
    ]);

    const result = await handler.execute(query);

    expect(storageMock.signedGetUrl).toHaveBeenCalledWith(
      'professionals/p-1/1/titulo.pdf',
      'documents',
      300,
    );
    expect(result.ok).toBe(true);
    expect(result.response).toEqual([
      { documentTypeId: 1, driveId: 'https://s3.example/signed?ttl=300' },
      { documentTypeId: 7, driveId: 'legacy-drive-id' },
    ]);
  });

  it('returns an error when the user does not exist', async () => {
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(null);
    const result = await handler.execute(new GetUploadedDocumentsQuery('x@y.z'));
    expect(result.ok).toBe(false);
    expect(repositoryMock.getUploadedDocuments).not.toHaveBeenCalled();
  });

  it('rethrows as InternalServerErrorException on repository failure', async () => {
    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(handler.execute(new GetUploadedDocumentsQuery('x@y.z'))).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(i18nMock.translate).toHaveBeenCalledWith(
      'professionalDocument.getUploadDocument.errorMessage',
    );
  });
});
