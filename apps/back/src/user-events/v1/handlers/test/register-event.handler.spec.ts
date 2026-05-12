
import { Test, TestingModule } from '@nestjs/testing';
import { RegisterEventHandler } from '../register-event.handler';
import { RegisterEventCommand } from '../../commands/register-event.command';
import { EventLogRepository } from '../../../../common/events/event-log.repository';
import { I18nService } from '../../../../i18n/i18n.service';
import { db } from '../../../../database/drizzle';
import { InternalServerErrorException } from '@nestjs/common';

jest.mock('../../../../database/drizzle', () => ({
    db: {
        transaction: jest.fn(),
    },
}));
describe('RegisterEventHandler', () => {
    let handler: RegisterEventHandler;
    let eventLogRepositoryMock: Partial<EventLogRepository>;
    let i18nServiceMock: Partial<I18nService>;

    beforeEach(async () => {
        eventLogRepositoryMock = {
            saveEvent: jest.fn(),
        };

        i18nServiceMock = {
            translate: jest.fn().mockImplementation((key: string) => key),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [RegisterEventHandler,
                { provide: EventLogRepository, useValue: eventLogRepositoryMock },
                { provide: I18nService, useValue: i18nServiceMock },
            ],
        }).compile();

        handler = module.get<RegisterEventHandler>(RegisterEventHandler);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should save an event and return a success response', async () => {
        const command = new RegisterEventCommand({
            idProfessional: "1b2e4567-e89b-12d3-a456-426614174000",
            eventType: "report_finalize",
            eventPayload: {
                studyId: "STUDY-001",
                timestamp: "2024-05-09T12:00:00Z",
                durationMs: 1284
            }
        });

        (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
            return await callback({});
        });

        const result = await handler.execute(command);

        expect(db.transaction).toHaveBeenCalled();
        expect(eventLogRepositoryMock.saveEvent).toHaveBeenCalledWith(expect.anything(), command.data);
        expect(i18nServiceMock.translate).toHaveBeenCalledWith('userEvent.registerEvent.save');
        expect(result).toEqual({ ok: true, message: 'userEvent.registerEvent.save' });
    });

    it('should throw an InternalServerErrorException if an error occurs', async () => {
        const command = new RegisterEventCommand({
            idProfessional: "1b2e4567-e89b-12d3-a456-426614174000",
            eventType: "report_finalize",
            eventPayload: {
                studyId: "STUDY-001",
                timestamp: "2024-05-09T12:00:00Z",
                durationMs: 1284
            }
        });

        const mockError = new Error('Database error');
        (db.transaction as jest.Mock).mockRejectedValue(mockError);

        await expect(handler.execute(command)).rejects.toThrow(InternalServerErrorException);

        expect(db.transaction).toHaveBeenCalled();
        expect(i18nServiceMock.translate).toHaveBeenCalledWith('userEvent.registerEvent.errorMessage');
    });
});
