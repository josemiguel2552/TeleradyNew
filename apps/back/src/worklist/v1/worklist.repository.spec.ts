import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../../database/drizzle', () => ({ db: {} }));

import { WorklistRepository } from './worklist.repository';
import { AesGcmService } from '../../common/crypto/aes-gcm.service';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { PseudonymService } from '../../common/crypto/pseudonym.service';
import { TenantScope } from '../../common/tenant/tenant-scope';
import { Role } from '../../auth/roles';
import { DBOrTx } from '../../database/drizzle';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';

const masterKey = Buffer.alloc(32, 5).toString('hex');
const pepper = Buffer.alloc(32, 9).toString('hex');
const aes = new AesGcmService({ getOrThrow: () => masterKey } as unknown as ConfigService);
const pseudonym = new PseudonymService({ getOrThrow: () => pepper } as unknown as ConfigService);
const enc = new ColumnEncryptionService(aes, pseudonym);

const radiologist: AuthenticatedUser = {
  id: 'u-1',
  email: 'r@x.es',
  roles: [Role.Radiologist],
  hospitalIds: ['h-1'],
  hospitalId: 'h-1',
  professionalId: 'prof-1',
};

function makeDb() {
  const limitFn = jest.fn();
  const orderByFn = jest.fn();
  const whereFn = jest.fn();
  const offsetFn = jest.fn();
  const fromFn = jest.fn();
  const selectFn = jest.fn();

  // chain: select -> from -> where -> orderBy -> limit -> offset
  offsetFn.mockResolvedValue([
    {
      id: 'rs-1',
      studyIuid: '1.2.3',
      studyDesc: 'CT Brain',
      studyCreatedTime: '2025-01-02T10:00:00Z',
      modalities: ['CT'],
      institution: 'Hospital X',
      hospitalId: 'h-1',
      reportStateId: 1,
      professionalId: 'prof-1',
      patNameEnc: enc.encrypt('María García', 'report_study:prof-1'),
      patBirthdateEnc: enc.encrypt('1985-04-23', 'report_study:prof-1'),
      patIdHash: enc.lookupHash('PAT-001'),
    },
  ]);
  limitFn.mockReturnValue({ offset: offsetFn });
  orderByFn.mockReturnValue({ limit: limitFn });

  // first call (count): select -> from -> where -> Promise<[{ count }]>
  let callCount = 0;
  whereFn.mockImplementation(() => {
    callCount += 1;
    if (callCount === 1) {
      return Promise.resolve([{ count: 1 }]);
    }
    return { orderBy: orderByFn };
  });

  fromFn.mockReturnValue({ where: whereFn });
  selectFn.mockReturnValue({ from: fromFn });

  return { select: selectFn, __whereFn: whereFn };
}

// findById path: select -> from -> where -> limit (single roundtrip).
function makeDbFindById(rows: unknown[]) {
  const limitFn = jest.fn().mockResolvedValue(rows);
  const whereFn = jest.fn(() => ({ limit: limitFn }));
  const fromFn = jest.fn(() => ({ where: whereFn }));
  const selectFn = jest.fn(() => ({ from: fromFn }));
  return { select: selectFn };
}

describe('WorklistRepository', () => {
  let repository: WorklistRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorklistRepository, { provide: ColumnEncryptionService, useValue: enc }],
    }).compile();
    repository = module.get<WorklistRepository>(WorklistRepository);
  });

  it('returns paginated, decrypted entries scoped by tenant', async () => {
    const db = makeDb();
    const result = await repository.list(TenantScope.for(radiologist), { limit: 10, offset: 0 } as any, db as unknown as DBOrTx);
    expect(result.total).toBe(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].patName).toBe('María García');
    expect(result.entries[0].patBirthdate).toBe('1985-04-23');
    expect(result.entries[0].patIdHash).toBe(enc.lookupHash('PAT-001'));
  });

  it('rejects an out-of-scope hospitalId for non-privileged actors', async () => {
    const db = makeDb();
    await expect(
      repository.list(
        TenantScope.for(radiologist),
        { hospitalId: 'h-99' } as any,
        db as unknown as DBOrTx,
      ),
    ).rejects.toThrow(/cross-tenant/);
  });

  it('passes through all optional filters (stateId, modality, date range)', async () => {
    const db = makeDb();
    await repository.list(
      TenantScope.for(radiologist),
      {
        limit: 5,
        offset: 0,
        hospitalId: 'h-1',
        stateId: 2,
        modality: 'CT',
        studyDateFrom: '20250101',
        studyDateTo: '2025-02-28',
      } as any,
      db as unknown as DBOrTx,
    );
    // The repository builds a single AND() with one condition per filter
    // plus the tenant scope. We do not introspect drizzle nodes — what we
    // assert is that the where() chain is reached twice (count + page) and
    // didn't throw on cross-tenant for the in-scope hospitalId.
    expect(db.__whereFn).toHaveBeenCalledTimes(2);
  });

  it('returns null from findById when the row is missing', async () => {
    const db = makeDbFindById([]);
    const out = await repository.findById(
      TenantScope.for(radiologist),
      'rs-missing',
      db as unknown as DBOrTx,
    );
    expect(out).toBeNull();
  });

  it('returns a decrypted entry from findById for a privileged actor (no tenant push)', async () => {
    const db = makeDbFindById([
      {
        id: 'rs-2',
        studyIuid: '1.2.3.4',
        studyDesc: null,
        studyCreatedTime: null,
        modalities: null,
        institution: null,
        hospitalId: 'h-2',
        reportStateId: 1,
        professionalId: 'prof-2',
        patNameEnc: enc.encrypt('Ana López', 'report_study:prof-2'),
        patBirthdateEnc: null,
        patIdHash: null,
      },
    ]);
    const admin: AuthenticatedUser = {
      id: 'a',
      email: 'a@x.es',
      roles: [Role.Admin],
      hospitalIds: [],
    };
    const out = await repository.findById(TenantScope.for(admin), 'rs-2', db as unknown as DBOrTx);
    expect(out).not.toBeNull();
    expect(out!.patName).toBe('Ana López');
    // Nullable fields fall back to default-empty shapes.
    expect(out!.modalities).toEqual([]);
    expect(out!.institution).toBeNull();
    expect(out!.patBirthdate).toBeNull();
  });
});
