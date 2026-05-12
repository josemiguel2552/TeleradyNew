import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { SaveReportHandler } from '../save-report.handler';
import { SaveReportCommand } from '../../commands/save-report.command';
import { ReportRepository } from '../../repositories/report.repository';
import { I18nService } from '../../../../i18n/i18n.service';
import { db } from '../../../../database/drizzle';
import { ReportStartEvent } from '../../events/impl/report-start.event';
import { Role } from '../../../../auth/roles';
import type { AuthenticatedUser } from '../../../../auth/jwt.strategy';

jest.mock('../../../../database/drizzle', () => ({
  db: { transaction: jest.fn() },
}));

const dto = {
  studyId: 'study-abc-123',
  studyDesc: 'CT chest',
  patId: 'pat-1',
  patName: 'Juan Pérez',
  sex: 'M',
  patBirthdate: '1985-04-23',
  modalities: ['CT'],
  institution: 'Hospital X',
  src: 'agent',
  idReportState: 1,
};

const radiologist: AuthenticatedUser = {
  id: 'u-1',
  email: 'r@x.es',
  roles: [Role.Radiologist],
  hospitalIds: ['h-1'],
  hospitalId: 'h-1',
  professionalId: 'prof-1',
};

const radiologistMulti: AuthenticatedUser = {
  ...radiologist,
  hospitalIds: ['h-1', 'h-2'],
};

const admin: AuthenticatedUser = {
  id: 'u-admin',
  email: 'admin@x.es',
  roles: [Role.Admin],
  hospitalIds: [],
  professionalId: 'prof-admin',
};

describe('SaveReportHandler', () => {
  let handler: SaveReportHandler;
  let reportRepositoryMock: jest.Mocked<Partial<ReportRepository>>;
  let eventBusMock: jest.Mocked<Partial<EventBus>>;
  let i18nMock: jest.Mocked<Partial<I18nService>>;

  beforeEach(async () => {
    reportRepositoryMock = {
      findForProfessionalAndStudy: jest.fn(),
      updateReport: jest.fn(),
      insertReport: jest.fn(),
    };
    eventBusMock = { publish: jest.fn() };
    i18nMock = { translate: jest.fn().mockImplementation((key: string) => key) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveReportHandler,
        { provide: ReportRepository, useValue: reportRepositoryMock },
        { provide: EventBus, useValue: eventBusMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();
    handler = module.get<SaveReportHandler>(SaveReportHandler);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('refuses to save when the actor has no professionalId', async () => {
    const actor: AuthenticatedUser = {
      id: 'u-2',
      email: 'u@x.es',
      roles: [Role.HospitalUser],
      hospitalIds: ['h-1'],
      hospitalId: 'h-1',
    };
    await expect(handler.execute(new SaveReportCommand(dto, actor))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('uses the single hospital of the radiologist when none is specified', async () => {
    (reportRepositoryMock.findForProfessionalAndStudy as jest.Mock).mockResolvedValue(null);
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    await handler.execute(new SaveReportCommand(dto, radiologist));

    expect(reportRepositoryMock.insertReport).toHaveBeenCalledWith(
      expect.anything(),
      dto,
      { professionalId: 'prof-1', hospitalId: 'h-1' },
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.any(ReportStartEvent),
    );
  });

  it('requires explicit hospitalId for multi-hospital actors', async () => {
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));
    await expect(
      handler.execute(new SaveReportCommand(dto, radiologistMulti)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects an explicit hospitalId outside the actor scope', async () => {
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));
    await expect(
      handler.execute(
        new SaveReportCommand({ ...dto, hospitalId: 'h-99' }, radiologist),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows admin to save without hospitalId', async () => {
    (reportRepositoryMock.findForProfessionalAndStudy as jest.Mock).mockResolvedValue({ id: 'r-1' });
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({}));

    const result = await handler.execute(new SaveReportCommand(dto, admin));

    expect(result.ok).toBe(true);
    expect(reportRepositoryMock.updateReport).toHaveBeenCalledWith(
      expect.anything(),
      dto,
      'r-1',
      { professionalId: 'prof-admin', hospitalId: null },
    );
  });

  it('translates and rethrows on unexpected errors', async () => {
    (db.transaction as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(handler.execute(new SaveReportCommand(dto, radiologist))).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(i18nMock.translate).toHaveBeenCalledWith('report.saveReport.errorMessage');
  });
});
