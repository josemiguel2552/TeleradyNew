import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { RegisterEventHandler } from '../register-event.handler';
import { RegisterEventCommand } from '../../commands/register-event.command';
import { EventLogRepository } from '../../../../common/events/event-log.repository';
import { I18nService } from '../../../../i18n/i18n.service';
import { db } from '../../../../database/drizzle';
import { Role } from '../../../../auth/roles';
import type { AuthenticatedUser } from '../../../../auth/jwt.strategy';

jest.mock('../../../../database/drizzle', () => ({
  db: { transaction: jest.fn() },
}));

const radiologist: AuthenticatedUser = {
  id: 'u-1',
  email: 'r@x.es',
  roles: [Role.Radiologist],
  hospitalIds: ['h-1'],
  hospitalId: 'h-1',
  professionalId: 'prof-1',
};

const dto = {
  eventType: 'report_finalize',
  eventPayload: { studyId: 'STUDY-001', durationMs: 1284 },
};

describe('RegisterEventHandler', () => {
  let handler: RegisterEventHandler;
  let eventLogRepositoryMock: Partial<EventLogRepository>;
  let i18nMock: Partial<I18nService>;

  beforeEach(async () => {
    eventLogRepositoryMock = { saveEvent: jest.fn() };
    i18nMock = { translate: jest.fn().mockImplementation((key: string) => key) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterEventHandler,
        { provide: EventLogRepository, useValue: eventLogRepositoryMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    handler = module.get<RegisterEventHandler>(RegisterEventHandler);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('persists the event with the actor professionalId', async () => {
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    const result = await handler.execute(new RegisterEventCommand(dto, radiologist));

    expect(eventLogRepositoryMock.saveEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idProfessional: 'prof-1',
        eventType: 'report_finalize',
        eventPayload: dto.eventPayload,
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('refuses to save when the actor has no professionalId', async () => {
    await expect(
      handler.execute(
        new RegisterEventCommand(dto, {
          id: 'u-2',
          email: 'a@x.es',
          roles: [Role.Admin],
          hospitalIds: [],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rethrows as InternalServerErrorException on unexpected errors', async () => {
    (db.transaction as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(
      handler.execute(new RegisterEventCommand(dto, radiologist)),
    ).rejects.toThrow(InternalServerErrorException);
    expect(i18nMock.translate).toHaveBeenCalledWith('userEvent.registerEvent.errorMessage');
  });
});
