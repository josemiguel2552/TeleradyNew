import { Test, TestingModule } from '@nestjs/testing';
import { ReportStartHandler } from '../report-start.handler';
import { ReportStartEvent } from '../../impl/report-start.event';
import { EventLogRepository } from '../../../../../common/events/event-log.repository';
import { db } from '../../../../../database/drizzle';
import { EventLog } from '../../../../../common/models/event-log.model';
import { ReportEventType } from '../../../../../common/constants/event-type.enum';

jest.mock('../../../../../database/drizzle', () => ({
    db: {
        transaction: jest.fn(),
    },
}));
describe('ReportStartHandler', () => {
    let handler: ReportStartHandler;
    let eventLogRepositoryMock: Partial<EventLogRepository>;

    beforeEach(async () => {
        eventLogRepositoryMock = {
            saveEvent: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [ReportStartHandler,
                { provide: EventLogRepository, useValue: eventLogRepositoryMock },
            ],
        }).compile();

        handler = module.get<ReportStartHandler>(ReportStartHandler);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should save the event log when handle is called', async () => {
        const mockEvent: ReportStartEvent = {
            data: {
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
            },
            action: 'start',
        };

        const mockTransaction = jest.fn(async (callback: any) => {
            await callback({});
        });
        (db.transaction as jest.Mock).mockImplementation(mockTransaction);

        await handler.handle(mockEvent);

        expect(db.transaction).toHaveBeenCalled();
        expect(eventLogRepositoryMock.saveEvent).toHaveBeenCalledWith(expect.anything(), {
            eventType: ReportEventType.START,
            idProfessional: mockEvent.data.idProfessional,
            eventPayload: { action: mockEvent.action, ...mockEvent.data },
        });
    });

    it('should log an error if an exception occurs', async () => {
        const mockEvent: ReportStartEvent = {
            data: {
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
            },
            action: 'start',
        };

        const mockError = new Error('Test error');
        (db.transaction as jest.Mock).mockRejectedValue(mockError);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        await handler.handle(mockEvent);

        expect(db.transaction).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('ReportStartHandler - Event', mockError);
    });
});
