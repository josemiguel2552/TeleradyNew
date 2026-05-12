-- =====================================================================
-- Telerady — RLS migration (apply only in production / staging)
-- =====================================================================
--
-- This migration:
--   1. Creates the two roles the platform expects: telerady_app (no
--      BYPASSRLS, used by the API) and telerady_migrator (BYPASSRLS,
--      used by drizzle-kit and ad-hoc operators).
--   2. Grants minimal privileges to telerady_app on the telerady schema.
--   3. Enables Row Level Security on every tenant-scoped table and
--      installs policies that read the request context from session-local
--      GUCs (app.current_user_id, app.current_hospital_ids,
--      app.is_privileged).
--
-- The API backend reads these GUCs in RlsContextInterceptor at the
-- beginning of every request (see apps/back/src/common/tenant/
-- rls-context.interceptor.ts). When unset, the policies fall through to
-- the "is_privileged=true" branch which is itself false, so by default
-- access is denied — fail closed.
--
-- Do NOT run this in dev: dev uses the seeded superuser which bypasses
-- RLS, which is exactly what you want while iterating locally.

-- ---------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'telerady_migrator') THEN
    CREATE ROLE telerady_migrator LOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'telerady_app') THEN
    CREATE ROLE telerady_app LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA telerady TO telerady_app, telerady_migrator;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA telerady TO telerady_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA telerady TO telerady_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA telerady
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO telerady_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA telerady
  GRANT USAGE, SELECT ON SEQUENCES TO telerady_app;

-- ---------------------------------------------------------------------
-- 2. Helper: read a hospital_id array from the GUC (NULL if unset)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION telerady._current_hospital_ids()
RETURNS uuid[] LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw text;
BEGIN
  BEGIN
    raw := current_setting('app.current_hospital_ids', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF raw IS NULL OR raw = '' THEN
    RETURN NULL;
  END IF;
  RETURN raw::uuid[];
END;
$$;

CREATE OR REPLACE FUNCTION telerady._is_privileged()
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw text;
BEGIN
  BEGIN
    raw := current_setting('app.is_privileged', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN COALESCE(raw::boolean, false);
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Policies
-- ---------------------------------------------------------------------
ALTER TABLE telerady.report_study ENABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.report_study FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rs_tenant ON telerady.report_study;
CREATE POLICY rs_tenant ON telerady.report_study
  FOR ALL
  USING (
    telerady._is_privileged()
    OR hospital_id = ANY (telerady._current_hospital_ids())
  )
  WITH CHECK (
    telerady._is_privileged()
    OR hospital_id = ANY (telerady._current_hospital_ids())
  );

ALTER TABLE telerady.event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.event_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS el_actor ON telerady.event_log;
CREATE POLICY el_actor ON telerady.event_log
  FOR ALL
  USING (
    telerady._is_privileged()
    OR professional_id::text = current_setting('app.current_professional_id', true)
  )
  WITH CHECK (
    telerady._is_privileged()
    OR professional_id::text = current_setting('app.current_professional_id', true)
  );

ALTER TABLE telerady.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.audit_log FORCE ROW LEVEL SECURITY;

-- Audit reads are restricted to the same tenant or to privileged roles.
-- Inserts are allowed for any authenticated request (the chain is the
-- integrity property; isolation matters mostly on read).
DROP POLICY IF EXISTS al_read ON telerady.audit_log;
CREATE POLICY al_read ON telerady.audit_log
  FOR SELECT
  USING (
    telerady._is_privileged()
    OR hospital_id IS NULL
    OR hospital_id = ANY (telerady._current_hospital_ids())
  );

DROP POLICY IF EXISTS al_insert ON telerady.audit_log;
CREATE POLICY al_insert ON telerady.audit_log
  FOR INSERT
  WITH CHECK (true);

ALTER TABLE telerady.hospital_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.hospital_membership FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hm_tenant ON telerady.hospital_membership;
CREATE POLICY hm_tenant ON telerady.hospital_membership
  FOR ALL
  USING (
    telerady._is_privileged()
    OR hospital_id = ANY (telerady._current_hospital_ids())
    OR user_id::text = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    telerady._is_privileged()
    OR hospital_id = ANY (telerady._current_hospital_ids())
  );

ALTER TABLE telerady.refresh_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.refresh_token FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rt_owner ON telerady.refresh_token;
CREATE POLICY rt_owner ON telerady.refresh_token
  FOR ALL
  USING (
    telerady._is_privileged()
    OR user_id::text = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    telerady._is_privileged()
    OR user_id::text = current_setting('app.current_user_id', true)
  );
