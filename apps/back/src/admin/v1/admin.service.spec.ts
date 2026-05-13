import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { PushService } from '../../integrations/push/push.service';
import { Role } from '../../auth/roles';

// Stage db.select + db.transaction so AdminService can run without
// touching real Postgres.
jest.mock('../../database/drizzle', () => {
  const limitQueue: unknown[] = [];
  const builder = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(() => Promise.resolve(limitQueue.shift() ?? [])),
  };
  return {
    db: {
      select: jest.fn(() => builder),
      transaction: jest.fn((cb: any) => cb({})),
      __limitQueue: limitQueue,
    },
  };
});

import { db } from '../../database/drizzle';

function queueRows(rows: unknown[][]) {
  const queue = (db as any).__limitQueue as unknown[];
  queue.length = 0;
  queue.push(...rows);
}

describe('AdminService.assignStudy', () => {
  let service: AdminService;
  let repo: jest.Mocked<AdminRepository>;
  let audit: jest.Mocked<AuditLogService>;
  let push: jest.Mocked<PushService>;
  const admin = {
    id: 'u-admin',
    email: 'admin@x.es',
    roles: [Role.Admin],
    hospitalIds: [],
    hospitalId: undefined,
  } as any;

  beforeEach(async () => {
    repo = {
      reassignStudy: jest.fn().mockResolvedValue(undefined),
    } as any;
    audit = { append: jest.fn().mockResolvedValue(undefined) } as any;
    push = { sendToProfessional: jest.fn().mockResolvedValue({}) } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: AdminRepository, useValue: repo },
        { provide: AuditLogService, useValue: audit },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    service = module.get(AdminService);
    jest.clearAllMocks();
  });

  it('reassigns the study and dispatches a push to the new primary', async () => {
    queueRows([
      [{ id: 'rs-1', hospitalId: null, professionalId: 'prof-old' }], // study
      [{ id: 'prof-new' }], // primary exists
    ]);
    const result = await service.assignStudy(
      'rs-1',
      { professionalId: 'prof-new' } as any,
      admin,
    );
    expect(repo.reassignStudy).toHaveBeenCalledWith({}, 'rs-1', 'prof-new');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'study.assigned' }),
      expect.anything(),
    );
    expect(push.sendToProfessional).toHaveBeenCalledWith(
      'prof-new',
      expect.objectContaining({
        category: 'study_assigned',
        url: '/radiologist/study/rs-1',
      }),
    );
    expect(result.professionalId).toBe('prof-new');
  });

  it('does not let a failing push abort the assignment', async () => {
    queueRows([
      [{ id: 'rs-2', hospitalId: null, professionalId: null }],
      [{ id: 'prof-new' }],
    ]);
    push.sendToProfessional.mockRejectedValueOnce(new Error('boom'));
    const result = await service.assignStudy(
      'rs-2',
      { professionalId: 'prof-new' } as any,
      admin,
    );
    expect(result.professionalId).toBe('prof-new');
    expect(repo.reassignStudy).toHaveBeenCalled();
  });
});
