# RLS activation — production runbook

This document walks the operator through enabling Postgres Row Level Security
on Telerady. Reading time ~5 minutes; cutover time ~10 minutes with no data
loss and one short window of "all reads blocked".

## Prerequisites

- Backup of the database in the last hour. Verify the dump restores cleanly
  before touching anything.
- `infra/migrations/001-enable-rls.sql` reviewed and merged.
- `RLS_ENABLED=true` available in the production env (do NOT set it yet).
- DBA credentials with the ability to `CREATE ROLE`.

## Steps

### 1. Apply the migration

```bash
psql "$DATABASE_URL_MIGRATOR" -f infra/migrations/001-enable-rls.sql
```

This creates the two roles (`telerady_app`, `telerady_migrator`), the helper
functions and the policies. The policies are FORCED on every table, but the
existing connection still uses a superuser so RLS bypass is implicit.

### 2. Provision passwords for the app role

```sql
ALTER ROLE telerady_app WITH PASSWORD 'long-random-passphrase-from-vault';
ALTER ROLE telerady_migrator WITH PASSWORD 'another-long-random-passphrase';
```

Push both passwords into Vault under `secret/telerady/db/{app,migrator}`.

### 3. Swap the application's connection string

Update `DATABASE_URL` in the production env to authenticate as
`telerady_app`. **Keep the previous superuser URL** parked under
`DATABASE_URL_MIGRATOR` so drizzle-kit migrations keep working.

### 4. Roll the API with `RLS_ENABLED=true`

Set `RLS_ENABLED=true` and roll the deployment. `RlsContextInterceptor` now
opens a transaction per request and pushes the actor's user_id,
professional_id, hospital_ids and is_privileged into the PG session as
`SET LOCAL` GUCs before each handler runs.

### 5. Smoke test (2 hospitals, 2 users)

1. Login as a radiologist of Hospital A.
2. `GET /v1/worklist` — must return only A's studies.
3. `GET /v1/worklist/<id-of-Bs-study>` — must return 404 (not 403 — we
   don't even acknowledge the row exists for another tenant).
4. Login as an admin — must see both tenants.
5. Direct DB check:
   ```sql
   SET ROLE telerady_app;
   SELECT count(*) FROM telerady.report_study; -- should be 0 outside a
                                               -- request context
   RESET ROLE;
   ```

### 6. Rollback (if needed)

Set `RLS_ENABLED=false`, restart the API, and run:

```sql
ALTER TABLE telerady.report_study     DISABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.report           DISABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.mwl_entry        DISABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.hl7_message      DISABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.event_log        DISABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.audit_log        DISABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.hospital_membership DISABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.refresh_token    DISABLE ROW LEVEL SECURITY;
```

You don't need to drop the policies; only the ENABLE flag matters.

## Day-2 operations

- Drizzle migrations always run with `DATABASE_URL_MIGRATOR` and never
  with the application role.
- When you add a new tenant-scoped table, add `ENABLE ROW LEVEL
  SECURITY` and a policy to `infra/migrations/00X-*.sql`.
- Test isolation between tenants is automated in
  `apps/back/test/e2e/tenant-isolation.spec.ts`. The suite boots a
  real Postgres testcontainer, applies the seed and the RLS migration,
  then exercises six scenarios (gate closed without GUC, hospital
  tenant filter, admin bypass, WITH CHECK on cross-tenant INSERT,
  audit_log read scoping, hospital_membership self-row visibility).
  Run it with:

  ```bash
  cd apps/back
  E2E=1 ./node_modules/.bin/jest --config test/e2e/jest.e2e.config.js
  ```

  The default `npm test` skips it (the specs use `it.skip` when
  `E2E !== '1'`) so contributors without Docker do not pay the boot
  cost.

## Interceptor wiring

`RlsContextInterceptor` is registered globally in
`apps/back/src/app.module.ts` as an `APP_INTERCEPTOR`. It self-gates on
`RLS_ENABLED`: when the flag is anything but `'true'` it short-circuits
to `next.handle()`, so dev environments are unaffected. Once the env
flips to `'true'` every request wraps its handler in a transaction
that issues `set_config('app.*', …, true)` for the four GUCs the
policies read.
