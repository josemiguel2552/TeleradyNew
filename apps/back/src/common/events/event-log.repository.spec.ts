import { Test, TestingModule } from '@nestjs/testing';
import { EventLogRepository } from './event-log.repository';
import { EventLog } from '../models/event-log.model';
import { db, DBOrTx } from '../../database/drizzle';
import { eventLogInTelerady } from '../../database/schema';

jest.mock('../../database/drizzle', () => ({
    db: {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        execute: jest.fn(),
    }
}));
describe('EventLogRepository', () => {
    let repository: EventLogRepository;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [EventLogRepository],
        }).compile();

        repository = module.get<EventLogRepository>(EventLogRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(repository).toBeDefined();
    });

    describe('saveEvent', () => {
        it('should save an event log into the database', async () => {
            const mockEvent: EventLog = {
                eventPayload: { action: 'start', additionalData: 'test' },
                eventType: 'START',
                idProfessional: '123',
            };

            (db.execute as jest.Mock).mockResolvedValue(undefined);

            await repository.saveEvent(db as DBOrTx, mockEvent);

            expect(db.insert).toHaveBeenCalledWith(eventLogInTelerady);
            expect(db.execute).toHaveBeenCalled();
        });
    });
});
