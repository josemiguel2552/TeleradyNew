import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Test, TestingModule } from "@nestjs/testing";
import { Request } from 'express';
import { I18nService } from "../../../i18n/i18n.service";
import { PersonalDataController } from "./personal-data.controller";
import { SaveProfessionalDto } from "../models/save-professional.dto";
import { SaveProfessionalCommand } from "../commands/save-professional.command";
import { SaveProfessionalResponse } from "../models/save-professional.entity";
import { ValidateResponse } from "../models/validate.entity";
import { ValidateQuery } from "../queries/validate.query";

describe('PersonalDataController', () => {
    let controller: PersonalDataController;
    let commandBusMock: Partial<CommandBus>;
    let queryBusMock: Partial<QueryBus>;
    let i18nServiceMock: Partial<I18nService>;

    beforeEach(async () => {
        commandBusMock = { execute: jest.fn() };
        queryBusMock = { execute: jest.fn() };
        i18nServiceMock = { setLang: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PersonalDataController],
            providers: [
                { provide: CommandBus, useValue: commandBusMock },
                { provide: QueryBus, useValue: queryBusMock },
                { provide: I18nService, useValue: i18nServiceMock },
            ],
        }).compile();

        controller = module.get<PersonalDataController>(PersonalDataController);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('saveProfessional', () => {
        it('should call setLang and execute SaveProfessionalCommand', async () => {
            const mockRequest = { headers: { 'accept-language': 'en' } } as Request;
            const mockBody: SaveProfessionalDto = {
                name: 'John',
                lastName: 'Doe',
                phone: '+123456789',
                email: 'john.doe@example.com',
                cityResidence: 'New York',
                titleStatusId: 1,
                professionalLicense: 'ABC123456',
                subspecialties: [101, 102],
            };
            const mockResponse: SaveProfessionalResponse = {
                ok: true,
                message: 'Professional saved successfully',
            };

            (commandBusMock.execute as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await controller.saveProfessional(mockRequest, mockBody);

            expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
            expect(commandBusMock.execute).toHaveBeenCalledWith(new SaveProfessionalCommand(mockBody));
            expect(result).toEqual(mockResponse);
        });

        it('should handle errors thrown by the command bus', async () => {
            const mockRequest = { headers: { 'accept-language': 'en' } } as Request;
            const mockBody: SaveProfessionalDto = {
                name: 'John',
                lastName: 'Doe',
                phone: '+123456789',
                email: 'john.doe@example.com',
                cityResidence: 'New York',
                titleStatusId: 1,
                professionalLicense: 'ABC123456',
                subspecialties: [101, 102],
            };

            (commandBusMock.execute as jest.Mock).mockRejectedValueOnce(new Error('Command execution failed'));

            await expect(controller.saveProfessional(mockRequest, mockBody)).rejects.toThrow('Command execution failed');
            expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
            expect(commandBusMock.execute).toHaveBeenCalledWith(new SaveProfessionalCommand(mockBody));
        });
    });

    describe('validateProfessional', () => {
        it('should call setLang and execute ValidateQuery', async () => {
            const mockRequest = { headers: { 'accept-language': 'en' } } as Request;
            const mockEmail = 'test@example.com';
            const mockResponse: ValidateResponse = {
                ok: true,
                message: 'Validation successful',
                response: { exists: true }
            };

            (queryBusMock.execute as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await controller.validateProfessional(mockRequest, mockEmail);

            expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
            expect(queryBusMock.execute).toHaveBeenCalledWith(new ValidateQuery(mockEmail));
            expect(result).toEqual(mockResponse);
        });

        it('should handle errors thrown by the query bus', async () => {
            const mockRequest = { headers: { 'accept-language': 'en' } } as Request;
            const mockEmail = 'test@example.com';

            (queryBusMock.execute as jest.Mock).mockRejectedValueOnce(new Error('Query execution failed'));

            await expect(controller.validateProfessional(mockRequest, mockEmail)).rejects.toThrow('Query execution failed');

            expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
            expect(queryBusMock.execute).toHaveBeenCalledWith(new ValidateQuery(mockEmail));
        });
    });
});
