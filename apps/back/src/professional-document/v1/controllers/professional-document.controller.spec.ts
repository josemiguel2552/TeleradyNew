import { Test, TestingModule } from '@nestjs/testing';
import { ProfessionalDocumentController } from './professional-document.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { I18nService } from '../../../i18n/i18n.service';
import { UploadDocumentDto } from '../models/upload-document.dto';
import { UploadDocumentCommand } from '../commands/upload-document.command';
import { GetUploadedDocumentsQuery } from '../queries/get-uploaded-documents.query';

describe('ProfessionalDocumentController', () => {
  let controller: ProfessionalDocumentController;
  let commandBusMock: Partial<CommandBus>;
  let queryBusMock: Partial<QueryBus>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    commandBusMock = {
      execute: jest.fn(),
    };

    queryBusMock = {
      execute: jest.fn(),
    };

    i18nServiceMock = {
      setLang: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfessionalDocumentController],
      providers: [
        { provide: CommandBus, useValue: commandBusMock },
        { provide: QueryBus, useValue: queryBusMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compile();

    controller = module.get<ProfessionalDocumentController>(ProfessionalDocumentController);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadDocument', () => {
    it('should call commandBus.execute with UploadDocumentCommand', async () => {
      const mockRequest: any = {
        user: { email: 'test@example.com' },
      };

      const mockData: UploadDocumentDto = {
        fileName: 'test.pdf',
        documentTypeId: 1,
        fileBase64: 'mock-base64',
      };

      const mockResponse = { ok: true, message: '', response: { driveId: 'mock-drive-id' } };
      (commandBusMock.execute as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.uploadDocument(mockRequest, mockData);

      expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
      expect(commandBusMock.execute).toHaveBeenCalledWith(
        new UploadDocumentCommand({ ...mockData, email: mockRequest.user.email }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getUploadedDocuments', () => {
    it('should call queryBus.execute with GetUploadedDocumentsQuery', async () => {
      const mockRequest: any = {
        user: { email: 'test@example.com' },
      };

      const mockResponse = {
        ok: true,
        message: '',
        response: [
          { documentTypeId: 1, driveId: 'drive-id-1' },
          { documentTypeId: 2, driveId: 'drive-id-2' },
        ],
      };

      (queryBusMock.execute as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.getUploadedDocuments(mockRequest);

      expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
      expect(queryBusMock.execute).toHaveBeenCalledWith(new GetUploadedDocumentsQuery(mockRequest.user.email));
      expect(result).toEqual(mockResponse);
    });
  });
});
