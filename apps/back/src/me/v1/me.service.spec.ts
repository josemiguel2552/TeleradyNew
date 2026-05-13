import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { Role } from '../../auth/roles';

jest.mock('../../database/drizzle', () => {
  // Stage select responses; record updates / inserts for assertions.
  const limitQueue: unknown[] = [];
  const allQueue: unknown[] = [];
  const updates: any[] = [];

  const select = jest.fn(() => {
    const builder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn(() => {
        // Either a `.limit()` follows (we resolve via limitQueue) or
        // the caller `await`s straight on `.where()` (allQueue).
        const next = {
          limit: jest.fn(() => Promise.resolve(limitQueue.shift() ?? [])),
          then: (resolve: any) => resolve(allQueue.shift() ?? []),
        };
        return next as any;
      }),
    };
    return builder;
  });

  const updateBuilder = {
    set: jest.fn((v: unknown) => {
      updates.push(v);
      return { where: jest.fn().mockResolvedValue(undefined) };
    }),
  };

  return {
    db: {
      select,
      update: jest.fn(() => updateBuilder),
      transaction: jest.fn((cb: any) =>
        cb({
          update: jest.fn(() => updateBuilder),
        }),
      ),
      __limitQueue: limitQueue,
      __allQueue: allQueue,
      __updates: updates,
    },
  };
});

import { db } from '../../database/drizzle';
import { MeService } from './me.service';

const radUser = {
  id: 'user-1',
  email: 'rad@x.es',
  roles: [Role.Radiologist],
  hospitalIds: ['h-1'],
  hospitalId: 'h-1',
  professionalId: 'prof-1',
} as any;

function queueLimits(rows: unknown[][]) {
  (db as any).__limitQueue.length = 0;
  (db as any).__limitQueue.push(...rows);
}
function queueAll(rows: unknown[][]) {
  (db as any).__allQueue.length = 0;
  (db as any).__allQueue.push(...rows);
}

describe('MeService', () => {
  let service: MeService;
  let audit: jest.Mocked<AuditLogService>;
  let enc: jest.Mocked<ColumnEncryptionService>;

  beforeEach(async () => {
    audit = { append: jest.fn().mockResolvedValue(undefined) } as any;
    enc = {
      decryptIfPresent: jest.fn().mockReturnValue('ES12 secret bank account'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        { provide: AuditLogService, useValue: audit },
        { provide: ColumnEncryptionService, useValue: enc },
      ],
    }).compile();

    service = module.get(MeService);
    jest.clearAllMocks();
    (db as any).__updates.length = 0;
  });

  it('export bundles user, roles, hospitals, professional, freelancer and subspecialties', async () => {
    queueLimits([
      [{ id: 'user-1', email: 'rad@x.es', mfaEnabled: true, professionalId: 'prof-1' }], // user
      [{ id: 'prof-1', name: 'Pepa' }], // professional
      [
        {
          professionalId: 'prof-1',
          bankAccountEnc: 'gcm:enc',
          bankAccount: null,
        },
      ], // freelancer
    ]);
    queueAll([
      [{ role: Role.Radiologist }, { role: 'on_call' }], // roles
      [{ hospitalId: 'h-1' }, { hospitalId: 'h-2' }], // hospitals
      [{ id: 1 }, { id: 2 }, { id: 3 }], // subspecialties
    ]);
    const out = await service.export(radUser);
    expect(out.user.id).toBe('user-1');
    expect(out.roles).toEqual([Role.Radiologist, 'on_call']);
    expect(out.hospitals).toEqual(['h-1', 'h-2']);
    expect(out.subspecialties).toEqual([1, 2, 3]);
    expect(out.professional?.id).toBe('prof-1');
    // bank account decrypted in the payload.
    expect(out.freelancerData?.bankAccount).toBe('ES12 secret bank account');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rgpd.data_export', targetKind: 'User' }),
    );
  });

  it('export still works for users without a professional record (HospitalAdmin, etc.)', async () => {
    queueLimits([[{ id: 'user-2', email: 'h@x.es', mfaEnabled: false, professionalId: null }]]);
    queueAll([[], []]);
    const out = await service.export({
      ...radUser,
      professionalId: undefined,
      roles: [Role.HospitalAdmin],
    });
    expect(out.professional).toBeNull();
    expect(out.freelancerData).toBeNull();
    expect(out.subspecialties).toEqual([]);
  });

  it('setProcessingRestriction toggles the flag and audits', async () => {
    await service.setProcessingRestriction(radUser, true);
    expect((db as any).__updates.some((u: any) => u.processingRestricted === true)).toBe(true);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rgpd.processing_restriction',
        payload: expect.objectContaining({ restricted: true }),
      }),
    );
  });

  it('deleteAccount tombstones the user + professional and audits inside the same tx', async () => {
    const out = await service.deleteAccount(radUser);
    // user-row update: email tombstoned, passwordHash blanked.
    const userUpdate = (db as any).__updates.find((u: any) => u.email?.startsWith('deleted-'));
    expect(userUpdate).toBeTruthy();
    expect(userUpdate.passwordHash).toBe('');
    expect(userUpdate.mfaEnabled).toBe(false);
    // professional row: name/lastName redacted.
    const profUpdate = (db as any).__updates.find((u: any) => u.name === 'redacted');
    expect(profUpdate).toBeTruthy();
    // audit row inside the transaction.
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rgpd.account_deleted' }),
      expect.anything(),
    );
    expect(out.deletedAt).toMatch(/Z$/);
  });
});
