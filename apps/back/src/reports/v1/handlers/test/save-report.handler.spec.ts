import { Test, TestingModule } from '@nestjs/testing';
import { SaveReportHandler } from '../save-report.handler';
import { SaveReportCommand } from '../../commands/save-report.command';
import { ReportRepository } from '../../repositories/report.repository';
import { EventBus } from '@nestjs/cqrs';
import { I18nService } from '../../../../i18n/i18n.service';
import { db } from '../../../../database/drizzle';
import { ReportStartEvent } from '../../events/impl/report-start.event';
import { InternalServerErrorException } from '@nestjs/common';

jest.mock('../../../../database/drizzle', () => ({
    db: {
        transaction: jest.fn(),
    },
}));
describe('SaveReportHandler', () => {
    let handler: SaveReportHandler;
    let reportRepositoryMock: Partial<ReportRepository>;
    let eventBusMock: Partial<EventBus>;
    let i18nServiceMock: Partial<I18nService>;

    beforeEach(async () => {
        reportRepositoryMock = {
            getReport: jest.fn(),
            updateReport: jest.fn(),
            insertReport: jest.fn(),
        };

        eventBusMock = {
            publish: jest.fn(),
        };

        i18nServiceMock = {
            translate: jest.fn().mockImplementation((key: string) => key),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [SaveReportHandler,
                { provide: ReportRepository, useValue: reportRepositoryMock },
                { provide: EventBus, useValue: eventBusMock },
                { provide: I18nService, useValue: i18nServiceMock },
            ],
        }).compile();

        handler = module.get<SaveReportHandler>(SaveReportHandler);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should update an existing report and publish an update event', async () => {
        const command = new SaveReportCommand({
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
        });

        const mockReport = { id: 'report-123' };

        (reportRepositoryMock.getReport as jest.Mock).mockResolvedValue(mockReport);
        (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
            return await callback({});
        });

        const result = await handler.execute(command);

        expect(reportRepositoryMock.getReport).toHaveBeenCalledWith(expect.anything(), command.data.idProfessional, command.data.studyId);
        expect(reportRepositoryMock.updateReport).toHaveBeenCalledWith(expect.anything(), command.data, mockReport.id);
        expect(eventBusMock.publish).toHaveBeenCalledWith(new ReportStartEvent(command.data, 'update'));
        expect(result).toEqual({ ok: true, message: 'report.saveReport.update' });
    });

    it('should insert a new report and publish an insert event', async () => {
        const command = new SaveReportCommand({
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
        });

        (reportRepositoryMock.getReport as jest.Mock).mockResolvedValue(null);
        (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
            return await callback({});
        });

        const result = await handler.execute(command);

        expect(reportRepositoryMock.getReport).toHaveBeenCalledWith(expect.anything(), command.data.idProfessional, command.data.studyId);
        expect(reportRepositoryMock.insertReport).toHaveBeenCalledWith(expect.anything(), command.data);
        expect(eventBusMock.publish).toHaveBeenCalledWith(new ReportStartEvent(command.data, 'insert'));
        expect(result).toEqual({ ok: true, message: 'report.saveReport.save' });
    });

    it('should throw an InternalServerErrorException if an error occurs', async () => {
        const command = new SaveReportCommand({
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
        });

        const mockError = new Error('Database error');
        (db.transaction as jest.Mock).mockRejectedValue(mockError);

        await expect(handler.execute(command)).rejects.toThrow(InternalServerErrorException);

        expect(i18nServiceMock.translate).toHaveBeenCalledWith('report.saveReport.errorMessage');
        expect(eventBusMock.publish).not.toHaveBeenCalled();
    });
});
