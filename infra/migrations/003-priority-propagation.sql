-- =====================================================================
-- Telerady — Sprint 35: HL7 priority propagation
-- =====================================================================
--
-- Adds the `priority` column on mwl_entry (where HL7 lands it) and on
-- report_study (where PacsIngest copies it), plus an index on
-- report_study.accession_number that becomes the join key between the
-- two. All ADD COLUMN IF NOT EXISTS so the migration is idempotent and
-- the operator can re-run it without breaking anything.
--
-- Zero downtime: ADD COLUMN with no DEFAULT is metadata-only in
-- Postgres; readers see the new column appear atomically.

ALTER TABLE telerady.mwl_entry
    ADD COLUMN IF NOT EXISTS priority VARCHAR(16);

ALTER TABLE telerady.report_study
    ADD COLUMN IF NOT EXISTS accession_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS priority VARCHAR(16);

CREATE INDEX CONCURRENTLY IF NOT EXISTS report_study_accession_idx
    ON telerady.report_study (accession_number);
