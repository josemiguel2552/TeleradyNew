import { Test, TestingModule } from '@nestjs/testing';
import { ParametersRepository } from './parameters.repository';
import { I18nService } from '../../../i18n/i18n.service';
import { db } from '../../../database/drizzle';
import { subspecialtyInTelerady } from '../../../database/schema';

jest.mock('../../../database/drizzle', () => ({
    db: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        execute: jest.fn(),
    },
}));

describe('ParametersRepository', () => {
    let repository: ParametersRepository;
    let i18nServiceMock: Partial<I18nService>;

    beforeEach(async () => {
        i18nServiceMock = {
            getLang: jest.fn().mockReturnValue('en'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ParametersRepository,
                { provide: I18nService, useValue: i18nServiceMock },
            ],
        }).compile();

        repository = module.get<ParametersRepository>(ParametersRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('get subspecialties', () => {
        it('should return mapped subspecialties in English', async () => {
            const mockDbResult = [
                { id: 1, name: 'Cardiology' },
                { id: 2, name: 'Neurology' },
            ];
            (db.execute as jest.Mock).mockResolvedValue(mockDbResult);

            const result = await repository.getSubspecialties(db);

            expect(i18nServiceMock.getLang).toHaveBeenCalled();
            expect(db.select).toHaveBeenCalledWith({
                id: subspecialtyInTelerady.id,
                name: subspecialtyInTelerady.nameEn,
            });
            expect(db.execute).toHaveBeenCalled();
            expect(result).toEqual(mockDbResult);
        });

        it('should return mapped subspecialties in default language', async () => {
            (i18nServiceMock.getLang as jest.Mock).mockReturnValue('es');

            const mockDbResult = [
                { id: 1, name: 'Cardiología' },
                { id: 2, name: 'Neurología' },
            ];
            (db.execute as jest.Mock).mockResolvedValue(mockDbResult);

            const result = await repository.getSubspecialties(db);

            expect(i18nServiceMock.getLang).toHaveBeenCalled();
            expect(db.select).toHaveBeenCalledWith({
                id: subspecialtyInTelerady.id,
                name: subspecialtyInTelerady.name,
            });
            expect(db.execute).toHaveBeenCalled();
            expect(result).toEqual(mockDbResult);
        });
    });
});