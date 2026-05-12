import { Test, TestingModule } from "@nestjs/testing";
import { db } from "../../../database/drizzle";
import { I18nService } from "../../../i18n/i18n.service";
import { PersonalDataRepository } from "./personal-data.repository";
import { SaveProfessionalDto } from "../../../personal-data/v1/models/save-professional.dto";

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

describe('PersonalDataRepository', () => {
    let repository: PersonalDataRepository;
    let i18nServiceMock: Partial<I18nService>;

    beforeEach(async () => {
        i18nServiceMock = {
            getLang: jest.fn().mockReturnValue('en'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PersonalDataRepository,
                { provide: I18nService, useValue: i18nServiceMock },
            ],
        }).compile();

        repository = module.get<PersonalDataRepository>(PersonalDataRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('validateProfessional', () => {
        it('should return false if no user is found in authUser', async () => {
            (db.execute as jest.Mock).mockResolvedValueOnce([]);

            const result = await repository.validateProfessional(db, 'test@example.com');

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should return false if no user is found in professionalInTelerady', async () => {
            (db.execute as jest.Mock)
                .mockResolvedValueOnce([{ id: 1 }])
                .mockResolvedValueOnce([]);

            const result = await repository.validateProfessional(db, 'test@example.com');

            expect(db.select).toHaveBeenCalledTimes(2);
            expect(db.execute).toHaveBeenCalledTimes(2);
            expect(result).toBe(false);
        });

        it('should return true if user is found in both authUser and professionalInTelerady', async () => {
            (db.execute as jest.Mock)
                .mockResolvedValueOnce([{ id: 1 }])
                .mockResolvedValueOnce([{ id: 1 }]);

            const result = await repository.validateProfessional(db, 'test@example.com');

            expect(db.select).toHaveBeenCalledTimes(2);
            expect(db.execute).toHaveBeenCalledTimes(2);
            expect(result).toBe(true);
        });
    });

    describe('getTitleSpecialtyById', () => {
        it('should return the title specialty if found', async () => {
            const mockTitleSpecialty = { id: 1 };
            (db.execute as jest.Mock).mockResolvedValueOnce([mockTitleSpecialty]);

            const result = await repository.getTitleSpecialtyById(db, 1);

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toEqual(mockTitleSpecialty);
        });

        it('should return null if no title specialty is found', async () => {
            (db.execute as jest.Mock).mockResolvedValueOnce([]);

            const result = await repository.getTitleSpecialtyById(db, 1);

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });

    describe('getPersonalDataByEmail', () => {
        it('should return the personal data if found', async () => {
            const mockPersonalData = { id: '123' };
            (db.execute as jest.Mock).mockResolvedValueOnce([mockPersonalData]);

            const result = await repository.getPersonalDataByEmail(db, 'test@example.com');

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toEqual(mockPersonalData);
        });

        it('should return null if no personal data is found', async () => {
            (db.execute as jest.Mock).mockResolvedValueOnce([]);

            const result = await repository.getPersonalDataByEmail(db, 'test@example.com');

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });

    describe('updatePersonalData', () => {
        it('should update personal data successfully', async () => {
            const mockData: SaveProfessionalDto = {
                name: 'John',
                lastName: 'Doe',
                phone: '+123456789',
                email: 'john.doe@example.com',
                cityResidence: 'New York',
                titleStatusId: 1,
                professionalLicense: 'ABC123456',
                subspecialties: [101, 102],
            };

            await repository.updatePersonalData(db, '123', mockData);

            expect(db.update).toHaveBeenCalledWith(expect.anything());
            expect(db.execute).toHaveBeenCalled();
        });
    });

    describe('savePersonalData', () => {
        it('should save personal data and return the inserted ID', async () => {
            const mockData: SaveProfessionalDto = {
                name: 'Jane',
                lastName: 'Smith',
                phone: '+987654321',
                email: 'jane.smith@example.com',
                cityResidence: 'Los Angeles',
                titleStatusId: 2,
                professionalLicense: 'XYZ987654',
                subspecialties: [201, 202],
            };

            const mockInsertedId = { id: '456' };
            (db.execute as jest.Mock).mockResolvedValueOnce([mockInsertedId]);

            const result = await repository.savePersonalData(db, mockData);

            expect(db.insert).toHaveBeenCalledWith(expect.anything());
            expect(db.execute).toHaveBeenCalled();
            expect(result).toBe(mockInsertedId.id);
        });
    });

    describe('saveSubspecialties', () => {
        it('should delete existing subspecialties and insert new ones', async () => {
            const idProfessional = '123';
            const subspecialtiesData = [1, 2, 3];

            await repository.saveSubspecialties(db, idProfessional, subspecialtiesData);

            expect(db.delete).toHaveBeenCalledWith(expect.anything());
            expect(db.execute).toHaveBeenCalledTimes(2);
            expect(db.insert).toHaveBeenCalledWith(expect.anything());
        });

        it('should handle empty subspecialtiesData gracefully', async () => {
            const idProfessional = '123';
            const subspecialtiesData: number[] = [];

            await repository.saveSubspecialties(db, idProfessional, subspecialtiesData);

            expect(db.delete).toHaveBeenCalledWith(expect.anything());
            expect(db.execute).toHaveBeenCalledTimes(1);
            expect(db.insert).not.toHaveBeenCalled();
        });
    });
    describe('saveOrUpdateProfessionalDocument', () => {
        it('should insert a new document if none exists', async () => {
            (db.execute as jest.Mock).mockResolvedValueOnce([]); // no existing document

            await repository.saveOrUpdateProfessionalDocument(
                db,
                'prof-123',
                1,
                'doc.pdf',
                'drive123'
            );

            expect(db.insert).toHaveBeenCalledWith(expect.anything());
            expect(db.execute).toHaveBeenCalled();
        });

        it('should update document if it already exists', async () => {
            (db.execute as jest.Mock).mockResolvedValueOnce([{ id: 'existing' }]); // doc exists

            await repository.saveOrUpdateProfessionalDocument(
                db,
                'prof-123',
                1,
                'doc.pdf',
                'drive456'
            );

            expect(db.update).toHaveBeenCalledWith(expect.anything());
            expect(db.execute).toHaveBeenCalled();
        });
    });

    describe('getUploadedDocument', () => {
        it('should return the document if it exists', async () => {
            const mockProfessionalId = '1';
            const mockDocumentId = 7;
            const mockDocument = [{ id: 1, documentId: mockDocumentId }];
            (db.execute as jest.Mock).mockResolvedValue(mockDocument);

            const result = await repository.getUploadedDocument(db, mockProfessionalId, mockDocumentId);

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toEqual(mockDocument[0]);
        });

        it('should return null if the document does not exist', async () => {
            const mockProfessionalId = '1';
            const mockDocumentId = 7;
            (db.execute as jest.Mock).mockResolvedValue([]);

            const result = await repository.getUploadedDocument(db, mockProfessionalId, mockDocumentId);

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
                driveId: 'drive-id',
            };

            (db.execute as jest.Mock).mockResolvedValue(undefined);

            await repository.uploadDocument(db, mockData);

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
                driveId: 'drive-id',
            };

            (db.execute as jest.Mock).mockResolvedValue({});

            await repository.insertDocument(db, mockData);

            expect(db.insert).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
        });
    });

});