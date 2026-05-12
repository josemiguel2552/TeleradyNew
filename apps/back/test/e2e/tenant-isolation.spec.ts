import { ConfigService } from '@nestjs/config';
import { AesGcmService } from '../../src/common/crypto/aes-gcm.service';
import { ColumnEncryptionService } from '../../src/common/crypto/column-encryption.service';
import { PseudonymService } from '../../src/common/crypto/pseudonym.service';
import { HashChainService } from '../../src/common/crypto/hash-chain.service';
import { AuditLogService } from '../../src/common/audit/audit-log.service';
import { TenantScope } from '../../src/common/tenant/tenant-scope';
import { WorklistRepository } from '../../src/worklist/v1/worklist.repository';
import { Role } from '../../src/auth/roles';
import { bootDatabase, resetTestRows, tearDown } from './setup-db';

// These e2e tests are heavy (testcontainers spin up real Postgres). They run
// only when E2E=1 is exported so plain `npm test` stays fast.
const e2eEnabled = process.env.E2E === '1';
const itE2E = e2eEnabled ? it : it.skip;

jest.setTimeout(120_000);

describe('E2E — tenant isolation against real Postgres', () => {
  let ctx: Awaited<ReturnType<typeof bootDatabase>>;
  const masterKey = Buffer.alloc(32, 7).toString('hex');
  const pepper = Buffer.alloc(32, 9).toString('hex');
  const aes = new AesGcmService({ getOrThrow: () => masterKey } as unknown as ConfigService);
  const pseudonym = new PseudonymService({ getOrThrow: () => pepper } as unknown as ConfigService);
  const enc = new ColumnEncryptionService(aes, pseudonym);

  beforeAll(async () => {
    if (!e2eEnabled) return;
    ctx = await bootDatabase();
    // Re-point the global drizzle module at the testcontainer.
    process.env.DATABASE_URL = ctx.connectionString;
    jest.resetModules();
  }, 120_000);

  afterAll(async () => {
    if (e2eEnabled) await tearDown();
  });

  beforeEach(async () => {
    if (!e2eEnabled) return;
    await resetTestRows(ctx);
  });

  itE2E('a hospital_user only sees the studies of their hospital', async () => {
    const { db } = ctx;

    // Two hospitals, one professional, two studies.
    const [hospitalA] = await db.execute<{ id: string }>(`
      INSERT INTO telerady.hospital (name) VALUES ('A') RETURNING id;
    `);
    const [hospitalB] = await db.execute<{ id: string }>(`
      INSERT INTO telerady.hospital (name) VALUES ('B') RETURNING id;
    `);
    const [professional] = await db.execute<{ id: string }>(`
      INSERT INTO telerady.professional (name, last_name, email, city_residence)
      VALUES ('P', 'R', 'p@r.es', 'M')
      RETURNING id;
    `);

    const insertStudy = (hospitalId: string, suffix: string) =>
      db.execute(`
        INSERT INTO telerady.report_study
          (hospital_id, professional_id, study_iuid, study_desc, sex,
           institution, src, report_state_id)
        VALUES
          ('${hospitalId}', '${professional[0].id ?? (professional as any).id}',
           '1.2.3.${suffix}', 'CT', 'F', 'X', 'seed', 1);
      `);
    await insertStudy(hospitalA[0]?.id ?? (hospitalA as any).id, 'A');
    await insertStudy(hospitalB[0]?.id ?? (hospitalB as any).id, 'B');

    const repo = new WorklistRepository(enc);
    const scopeA = TenantScope.for({
      id: 'u-a',
      email: 'a@x.es',
      roles: [Role.HospitalUser],
      hospitalIds: [hospitalA[0]?.id ?? (hospitalA as any).id],
      hospitalId: hospitalA[0]?.id ?? (hospitalA as any).id,
    });
    const list = await repo.list(scopeA, { limit: 100, offset: 0 } as any, db as any);
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0].studyInstanceUid.endsWith('A')).toBe(true);
  });

  itE2E('an admin actor sees every tenant', async () => {
    const { db } = ctx;
    const [hospitalA] = await db.execute<{ id: string }>(`
      INSERT INTO telerady.hospital (name) VALUES ('A') RETURNING id;
    `);
    const [hospitalB] = await db.execute<{ id: string }>(`
      INSERT INTO telerady.hospital (name) VALUES ('B') RETURNING id;
    `);
    const [professional] = await db.execute<{ id: string }>(`
      INSERT INTO telerady.professional (name, last_name, email, city_residence)
      VALUES ('P', 'R', 'p@r.es', 'M')
      RETURNING id;
    `);
    const pid = professional[0]?.id ?? (professional as any).id;
    await db.execute(`
      INSERT INTO telerady.report_study (hospital_id, professional_id, study_iuid, study_desc, sex, institution, src, report_state_id)
      VALUES
        ('${hospitalA[0]?.id ?? (hospitalA as any).id}', '${pid}', '1.2.3.A', 'CT', 'F', 'X', 'seed', 1),
        ('${hospitalB[0]?.id ?? (hospitalB as any).id}', '${pid}', '1.2.3.B', 'CT', 'F', 'Y', 'seed', 1);
    `);
    const repo = new WorklistRepository(enc);
    const admin = TenantScope.for({
      id: 'u-admin',
      email: 'admin@x.es',
      roles: [Role.Admin],
      hospitalIds: [],
    });
    const list = await repo.list(admin, { limit: 100, offset: 0 } as any, db as any);
    expect(list.total).toBe(2);
  });

  itE2E('audit log replay catches a manual UPDATE', async () => {
    const chain = new HashChainService();
    const audit = new AuditLogService(chain, { get: () => null } as unknown as ConfigService);
    const ctxToken = TenantScope.for({
      id: 'u',
      email: 'u@e.s',
      roles: [Role.Admin],
      hospitalIds: [],
    });
    void ctxToken;

    await audit.append({
      action: 'test.one',
      targetKind: 'X',
      targetId: 'a',
      payload: { v: 1 },
    });
    await audit.append({
      action: 'test.two',
      targetKind: 'X',
      targetId: 'b',
      payload: { v: 2 },
    });

    // Tamper one row.
    await ctx.client.query(
      `UPDATE telerady.audit_log SET payload = jsonb_set(payload, '{v}', '99'::jsonb)
       WHERE action = 'test.two'`,
    );

    const result = await audit.verify();
    expect(result.ok).toBe(false);
  });
});
