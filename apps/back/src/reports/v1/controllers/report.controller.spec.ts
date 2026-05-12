import { Test, TestingModule } from '@nestjs/testing';
import { ReportController } from './report.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { I18nService } from '../../../i18n/i18n.service';
import { SaveReportDto } from '../models/save-report.dto';
import { SaveReportCommand } from '../commands/save-report.command';
import { Request } from 'express';

describe('ReportController', () => {
    let controller: ReportController;
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
            controllers: [ReportController],
            providers: [
                { provide: CommandBus, useValue: commandBusMock },
                { provide: QueryBus, useValue: queryBusMock },
                { provide: I18nService, useValue: i18nServiceMock },
            ],
        }).compile();

        controller = module.get<ReportController>(ReportController);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('saveReport', () => {
        it('should call commandBus.execute with SaveReportCommand', async () => {
            const mockRequest = {
                headers: { 'accept-language': 'en' },
            } as Request;

            const mockData: SaveReportDto = {
                idProfessional: "1b2e4567-e89b-12d3-a456-426614174000",
                studyId: "study-abc-123",
                studyDesc: "TC de tórax sin contraste",
                patId: "pat-123456",
                patName: "Juan Pérez",
                sex: "M",
                patBirthdate: "1985-04-23",
                modalities: ["CT", "MR"],
                institution: "Hospital Universitario de Madrid",
                src: "PACS",
                idReportState: 1
            };

            const mockResponse = { ok: true, message: 'Report saved successfully' };
            (commandBusMock.execute as jest.Mock).mockResolvedValue(mockResponse);

            const result = await controller.saveReport(mockRequest, mockData);

            expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
            expect(commandBusMock.execute).toHaveBeenCalledWith(new SaveReportCommand(mockData));
            expect(result).toEqual(mockResponse);
        });
    });
});
