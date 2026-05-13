import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EventLogRepository } from './event-log.repository';
import type { EventLog } from '../models/event-log.model';
import { db, type DBOrTx } from '../../database/drizzle';
import { eventLogInTelerady } from '../../database/schema';
import { PseudonymService } from '../crypto/pseudonym.service';

jest.mock('../../database/drizzle', () => ({
  db: {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  },
}));

describe('EventLogRepository', () => {
  let repository: EventLogRepository;
  const pseudonym = new PseudonymService({
    getOrThrow: () => Buffer.alloc(32, 7).toString('hex'),
  } as unknown as ConfigService);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventLogRepository,
        { provide: PseudonymService, useValue: pseudonym },
      ],
    }).compile();

    repository = module.get<EventLogRepository>(EventLogRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    expect(repository).toBeDefined();
  });

  it('persists sanitised payloads', async () => {
    const event: EventLog = {
      eventType: 'report_finalize',
      idProfessional: 'p-1',
      eventPayload: {
        action: 'finalize',
        studyId: 'STUDY-001',
        patId: '12345678A',
        patName: 'María García',
        nested: { phone: '+34 600 000 000', other: 'keep' },
      },
    };
    (db.execute as jest.Mock).mockResolvedValue(undefined);

    await repository.saveEvent(db as DBOrTx, event);

    expect(db.insert).toHaveBeenCalledWith(eventLogInTelerady);
    const values = ((db as any).values as jest.Mock).mock.calls[0][0];
    expect(values.eventType).toBe('report_finalize');
    expect(values.eventPayload.patId).toBe(pseudonym.hash('12345678A'));
    expect(values.eventPayload.patName).toBe('[REDACTED]');
    expect(values.eventPayload.nested.phone).toBe('[REDACTED]');
    expect(values.eventPayload.nested.other).toBe('keep');
    expect(values.eventPayload.studyId).toBe('STUDY-001');
  });

  it('handles primitive payloads gracefully', () => {
    expect(repository.sanitise(42)).toBe(42);
    expect(repository.sanitise(null)).toBe(null);
  });
});
