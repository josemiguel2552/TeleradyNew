-- =====================================================================
-- Telerady — Sprint 32: hot-path indexes
-- =====================================================================
--
-- Adds indexes that the existing queries (worklist filter, per-radiologist
-- list, study_iuid lookup at ingest, SLA report fan-out, audit verb
-- filter, event_log per professional) were doing full scans on.
--
-- All CREATE INDEX CONCURRENTLY so production cutovers do not lock
-- writes on big tenants. The IF NOT EXISTS keeps a re-run idempotent.
-- Important: CONCURRENTLY cannot be used inside a transaction — run
-- each statement separately (psql does that by default when you `\i`
-- the file).
--
-- Operational impact:
--   - Each index takes a few seconds to a couple of minutes on a multi
--     million row table.
--   - Zero downtime; readers see them appear atomically once each
--     CREATE INDEX commits.

CREATE INDEX CONCURRENTLY IF NOT EXISTS report_study_worklist_idx
    ON telerady.report_study (hospital_id, report_state_id, study_created_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS report_study_professional_idx
    ON telerady.report_study (professional_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS report_study_study_iuid_idx
    ON telerady.report_study (study_iuid);

CREATE INDEX CONCURRENTLY IF NOT EXISTS report_professional_idx
    ON telerady.report (professional_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS report_signed_at_idx
    ON telerady.report (signed_at)
    WHERE signed_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_action_idx
    ON telerady.audit_log (action);

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_log_professional_type_idx
    ON telerady.event_log (professional_id, event_type, created_at);
