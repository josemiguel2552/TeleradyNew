/**
 * E2E — Postgres RLS isolation. Each `itE2E` runs against a real
 * Postgres container (testcontainers). The arrange phase seeds rows via
 * the migrator (BYPASSRLS); the assertions use a separate connection
 * authenticated as `telerady_app` (RLS forced) with the same GUC the
 * production interceptor sets.
 *
 * Gated on `E2E=1` so plain `npm test` stays fast.
 */
import type { Client } from 'pg';
import { bootDatabase, resetTestRows, tearDown, type E2EContext } from './setup-db';

const e2eEnabled = process.env.E2E === '1';
const itE2E = e2eEnabled ? it : it.skip;

jest.setTimeout(180_000);

interface TenantGuc {
  userId?: string;
  professionalId?: string;
  hospitalIds?: string[];
  privileged?: boolean;
}

async function withTenant<T>(
  client: Client,
  guc: TenantGuc,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query(
      `SELECT
        set_config('app.current_user_id', $1, true),
        set_config('app.current_professional_id', $2, true),
        set_config('app.current_hospital_ids', $3, true),
        set_config('app.is_privileged', $4, true)`,
      [
        guc.userId ?? '',
        guc.professionalId ?? '',
        guc.hospitalIds && guc.hospitalIds.length > 0
          ? `{${guc.hospitalIds.join(',')}}`
          : '',
        guc.privileged ? 'true' : 'false',
      ],
    );
    return await fn();
  } finally {
    await client.query('COMMIT');
  }
}

describe('E2E — RLS isolation against real Postgres', () => {
  let ctx: E2EContext;
  let appClient: Client;

  beforeAll(async () => {
    if (!e2eEnabled) return;
    ctx = await bootDatabase();
    appClient = await ctx.connectAsApp();
  }, 180_000);

  afterAll(async () => {
    if (!e2eEnabled) return;
    await appClient.end();
    await tearDown();
  });

  beforeEach(async () => {
    if (!e2eEnabled) return;
    await resetTestRows(ctx);
  });

  /** Seed the canonical fixture and return the relevant ids. */
  async function seedTwoHospitals() {
    const { rows: hospitals } = await ctx.migratorClient.query<{ id: string }>(`
      INSERT INTO telerady.hospital (name) VALUES ('A'), ('B') RETURNING id
    `);
    const [hospitalA, hospitalB] = hospitals;
    const { rows: professionals } = await ctx.migratorClient.query<{ id: string }>(`
      INSERT INTO telerady.professional (name, last_name, email, city_residence)
      VALUES ('P', 'R', 'p@r.es', 'M') RETURNING id
    `);
    const professionalId = professionals[0].id;
    await ctx.migratorClient.query(
      `INSERT INTO telerady.report_study
         (hospital_id, professional_id, study_iuid, study_desc, sex,
          institution, src, report_state_id)
       VALUES
         ($1, $3, '1.2.3.A', 'CT A', 'F', 'X', 'seed', 1),
         ($2, $3, '1.2.3.B', 'CT B', 'F', 'Y', 'seed', 1)`,
      [hospitalA.id, hospitalB.id, professionalId],
    );
    return { hospitalA: hospitalA.id, hospitalB: hospitalB.id, professionalId };
  }

  itE2E('without any GUC, telerady_app sees 0 rows (fail closed)', async () => {
    await seedTwoHospitals();
    const { rows } = await appClient.query('SELECT count(*)::int AS c FROM telerady.report_study');
    expect(rows[0].c).toBe(0);
  });

  itE2E('a hospital_user GUC only sees their hospital', async () => {
    const { hospitalA } = await seedTwoHospitals();
    const rows = await withTenant(
      appClient,
      { userId: 'u-a', hospitalIds: [hospitalA], privileged: false },
      async () => {
        const { rows } = await appClient.query(
          'SELECT study_iuid FROM telerady.report_study ORDER BY study_iuid',
        );
        return rows;
      },
    );
    expect(rows).toEqual([{ study_iuid: '1.2.3.A' }]);
  });

  itE2E('an admin GUC bypasses the tenant filter', async () => {
    await seedTwoHospitals();
    const rows = await withTenant(
      appClient,
      { userId: 'u-admin', privileged: true },
      async () => {
        const { rows } = await appClient.query(
          'SELECT count(*)::int AS c FROM telerady.report_study',
        );
        return rows;
      },
    );
    expect(rows[0].c).toBe(2);
  });

  itE2E('WITH CHECK blocks INSERT into a foreign hospital', async () => {
    const { hospitalA, hospitalB, professionalId } = await seedTwoHospitals();
    await expect(
      withTenant(
        appClient,
        { userId: 'u-a', hospitalIds: [hospitalA], privileged: false },
        async () =>
          appClient.query(
            `INSERT INTO telerady.report_study
               (hospital_id, professional_id, study_iuid, study_desc, sex,
                institution, src, report_state_id)
             VALUES ($1, $2, '1.2.3.X', 'CT X', 'F', 'X', 'seed', 1)`,
            [hospitalB, professionalId],
          ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  itE2E('audit_log SELECT is tenant-scoped', async () => {
    const { hospitalA, hospitalB } = await seedTwoHospitals();
    await ctx.migratorClient.query(
      `INSERT INTO telerady.audit_log
         (action, target_kind, target_id, hospital_id, payload, hash, prev_hash)
       VALUES
         ('test.one', 'X', 'a', $1, '{}'::jsonb, 'h1', NULL),
         ('test.two', 'X', 'b', $2, '{}'::jsonb, 'h2', 'h1')`,
      [hospitalA, hospitalB],
    );
    const rows = await withTenant(
      appClient,
      { hospitalIds: [hospitalA], privileged: false },
      async () => {
        const { rows } = await appClient.query(
          'SELECT action FROM telerady.audit_log ORDER BY action',
        );
        return rows;
      },
    );
    expect(rows).toEqual([{ action: 'test.one' }]);
  });

  itE2E('hospital_membership: a user only sees their own membership', async () => {
    const { hospitalA, hospitalB } = await seedTwoHospitals();
    const { rows: users } = await ctx.migratorClient.query<{ id: string }>(`
      INSERT INTO telerady.app_user (email, password_hash)
      VALUES ('user-a@x.es', 'pw'), ('user-b@x.es', 'pw') RETURNING id
    `);
    await ctx.migratorClient.query(
      `INSERT INTO telerady.hospital_membership (user_id, hospital_id)
       VALUES ($1, $2), ($3, $4)`,
      [users[0].id, hospitalA, users[1].id, hospitalB],
    );
    // user-A asks "where can I work?" — should see only A.
    const rows = await withTenant(
      appClient,
      { userId: users[0].id, hospitalIds: [hospitalA], privileged: false },
      async () => {
        const { rows } = await appClient.query(
          'SELECT hospital_id FROM telerady.hospital_membership ORDER BY hospital_id',
        );
        return rows;
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].hospital_id).toBe(hospitalA);
  });
});
