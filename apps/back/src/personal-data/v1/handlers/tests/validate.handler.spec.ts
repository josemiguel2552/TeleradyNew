import { Test, TestingModule } from "@nestjs/testing";
import { InternalServerErrorException } from "@nestjs/common";
import { I18nService } from "../../../../i18n/i18n.service";
import { ValidateHandler } from "../validate.handler";
import { PersonalDataRepository } from "../../repositories/personal-data.repository";
import { ValidateQuery } from "../../queries/validate.query";
import { db } from "../../../../database/drizzle";

describe('ValidateHandler', () => {
    let handler: ValidateHandler;
    let personalDataRepositoryMock: Partial<PersonalDataRepository>;
    let i18nServiceMock: Partial<I18nService>;

    beforeEach(async () => {
        personalDataRepositoryMock = {
            validateProfessional: jest.fn(),
        };

        i18nServiceMock = {
            translate: jest.fn((key: string) => key),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ValidateHandler,
                { provide: PersonalDataRepository, useValue: personalDataRepositoryMock },
                { provide: I18nService, useValue: i18nServiceMock },
            ],
        }).compile();

        handler = module.get<ValidateHandler>(ValidateHandler);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should return a successful validation response', async () => {
        const mockQuery = new ValidateQuery('test@example.com');
        const mockValidationResult = true;

        (personalDataRepositoryMock.validateProfessional as jest.Mock).mockResolvedValueOnce(mockValidationResult);

        const result = await handler.execute(mockQuery);

        expect(personalDataRepositoryMock.validateProfessional).toHaveBeenCalledWith(db, 'test@example.com');

        expect(result).toEqual({
            ok: true,
            message: '',
            response: { exists: mockValidationResult },
        });
    });

    it('should throw an InternalServerErrorException on error', async () => {
        const mockQuery = new ValidateQuery('test@example.com');

        (personalDataRepositoryMock.validateProfessional as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

        await expect(handler.execute(mockQuery)).rejects.toThrow(InternalServerErrorException);

        expect(i18nServiceMock.translate).toHaveBeenCalledWith('personalData.validateProfessional.errorMessage');
    });

});