import { Test, TestingModule } from '@nestjs/testing';
import { ProfessionalDocumentRepository } from './professional-document.repository';
import { db, DBOrTx } from '../../../database/drizzle';

jest.mock('../../../database/drizzle', () => ({
  db: {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn(),
  }
}));

describe('ProfessionalDocumentRepository', () => {
  let repository: ProfessionalDocumentRepository;

  beforeEach(async () => {

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfessionalDocumentRepository],
    }).compile();

    repository = module.get<ProfessionalDocumentRepository>(ProfessionalDocumentRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('getPersonalDataByEmail', () => {
    it('should return personal data if the user exists', async () => {
      const mockEmail = 'test@example.com';
      const mockPersonalData = [{ id: 1, email: mockEmail }];
      (db.execute as jest.Mock).mockResolvedValue(mockPersonalData);

      const result = await repository.getPersonalDataByEmail(db as DBOrTx, mockEmail);

      expect(db.select).toHaveBeenCalled();
      expect(db.execute).toHaveBeenCalled();
      expect(result).toEqual(mockPersonalData[0]);
    });

    it('should return null if the user does not exist', async () => {
      const mockEmail = 'test@example.com';
      (db.execute as jest.Mock).mockResolvedValue([]);

      const result = await repository.getPersonalDataByEmail(db as DBOrTx, mockEmail);

      expect(db.select).toHaveBeenCalled();
      expect(db.execute).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('getUploadedDocument', () => {
    it('should return the document if it exists', async () => {
      const mockProfessionalId = '1';
      const mockDocumentId = 7;
      const mockDocument = [{ id: 1, documentId: mockDocumentId }];
      (db.execute as jest.Mock).mockResolvedValue(mockDocument);

      const result = await repository.getUploadedDocument(db as DBOrTx, mockProfessionalId, mockDocumentId);

      expect(db.select).toHaveBeenCalled();
      expect(db.execute).toHaveBeenCalled();
      expect(result).toEqual(mockDocument[0]);
    });

    it('should return null if the document does not exist', async () => {
      const mockProfessionalId = '1';
      const mockDocumentId = 7;
      (db.execute as jest.Mock).mockResolvedValue([]);

      const result = await repository.getUploadedDocument(db as DBOrTx, mockProfessionalId, mockDocumentId);

      expect(db.select).toHaveBeenCalled();
      expect(db.execute).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('uploadDocument', () => {
    it('should update the document in the database', async () => {
      const mockData = {
        professionalId: '1',
        documentId: 7,
        nameDocument: 'test-document.pdf',
        storageBucket: 'telerady-documents',
        storageKey: 'doc/key',
      };

      (db.execute as jest.Mock).mockResolvedValue(undefined);

      await repository.uploadDocument(db as DBOrTx, mockData);

      expect(db.update).toHaveBeenCalled();
      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe('insertDocument', () => {
    it('should insert a new document into the database', async () => {
      const mockData = {
        professionalId: '1',
        documentId: 7,
        nameDocument: 'test-document.pdf',
        storageBucket: 'telerady-documents',
        storageKey: 'doc/key',
      };

      (db.execute as jest.Mock).mockResolvedValue({});

      await repository.insertDocument(db as DBOrTx, mockData);

      expect(db.insert).toHaveBeenCalled();
      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe('getUploadedDocuments', () => {
    it('should return a list of uploaded documents', async () => {
      const mockProfessionalId = '1';
      const mockDocuments = [
        { documentTypeId: 7, driveId: 'drive-id-1' },
        { documentTypeId: 8, driveId: 'drive-id-2' },
      ];
      (db.execute as jest.Mock).mockResolvedValue(mockDocuments);

      const result = await repository.getUploadedDocuments(db as DBOrTx, mockProfessionalId);

      expect(db.select).toHaveBeenCalled();
      expect(db.execute).toHaveBeenCalled();
      expect(result).toEqual(mockDocuments);
    });
  });
});
