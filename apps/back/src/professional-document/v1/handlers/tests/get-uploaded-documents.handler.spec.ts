import { Test, TestingModule } from '@nestjs/testing';
import { GetUploadedDocumentsHandler } from '../get-uploaded-documents.handler';
import { ProfessionalDocumentRepository } from '../../repositories/professional-document.repository';
import { I18nService } from '../../../../i18n/i18n.service';
import { GetUploadedDocumentsQuery } from '../../queries/get-uploaded-documents.query';
import { InternalServerErrorException } from '@nestjs/common';

describe('GetUploadedDocumentsHandler', () => {
  let handler: GetUploadedDocumentsHandler;
  let repositoryMock: Partial<ProfessionalDocumentRepository>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    repositoryMock = {
      getPersonalDataByEmail: jest.fn(),
      getUploadedDocuments: jest.fn(),
    };

    i18nServiceMock = {
      translate: jest.fn().mockImplementation((key: string) => key),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GetUploadedDocumentsHandler,
        { provide: ProfessionalDocumentRepository, useValue: repositoryMock },
        { provide: I18nService, useValue: i18nServiceMock },],
    }).compile();

    handler = module.get<GetUploadedDocumentsHandler>(GetUploadedDocumentsHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return documents if user exists', async () => {
    const mockQuery = new GetUploadedDocumentsQuery('test@example.com');
    const mockUser = { id: 1, email: 'test@example.com' };
    const mockDocuments = [
      { documentTypeId: 1, driveId: 'drive-id-1' },
      { documentTypeId: 2, driveId: 'drive-id-2' },
    ];

    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(mockUser);
    (repositoryMock.getUploadedDocuments as jest.Mock).mockResolvedValue(mockDocuments);

    const result = await handler.execute(mockQuery);

    expect(repositoryMock.getPersonalDataByEmail).toHaveBeenCalledWith(expect.anything(), mockQuery.email);
    expect(repositoryMock.getUploadedDocuments).toHaveBeenCalledWith(expect.anything(), mockUser.id);
    expect(result).toEqual({
      ok: true,
      message: '',
      response: mockDocuments.map(d => ({ documentTypeId: d.documentTypeId, driveId: d.driveId })),
    });
  });

  it('should return an error message if user does not exist', async () => {
    const mockQuery = new GetUploadedDocumentsQuery('test@example.com');

    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockResolvedValue(null);

    const result = await handler.execute(mockQuery);

    expect(repositoryMock.getPersonalDataByEmail).toHaveBeenCalledWith(expect.anything(), mockQuery.email);
    expect(repositoryMock.getUploadedDocuments).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      message: 'professionalDocument.getUploadDocument.errorMessage',
      response: [],
    });
  });

  it('should throw an InternalServerErrorException if an error occurs', async () => {
    const mockQuery = new GetUploadedDocumentsQuery('test@example.com');

    (repositoryMock.getPersonalDataByEmail as jest.Mock).mockRejectedValue(new Error('Database error'));

    await expect(handler.execute(mockQuery)).rejects.toThrow(InternalServerErrorException);

    expect(repositoryMock.getPersonalDataByEmail).toHaveBeenCalledWith(expect.anything(), mockQuery.email);
    expect(i18nServiceMock.translate).toHaveBeenCalledWith('professionalDocument.getUploadDocument.errorMessage');
  });
});
