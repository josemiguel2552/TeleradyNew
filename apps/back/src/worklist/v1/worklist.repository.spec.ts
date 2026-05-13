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
});
