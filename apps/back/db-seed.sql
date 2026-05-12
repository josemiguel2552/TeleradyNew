--> ************PARAMETRIC****************
CREATE SCHEMA telerady;

CREATE TABLE telerady.subspecialty (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL
);
insert into telerady.subspecialty (name, name_en) values ('Neurorradiología', 'Neuroradiology'), ('Radiología Musculoesquelética', 'Musculoskeletal Radiology'), ('Radiología Abdominal', 'Abdominal Radiology'), ('Radiología Torácica', 'Thoracic Radiology'), ('Radiología Cardiovascular', 'Cardiovascular Radiology'), ('Radiología Pediátrica', 'Pediatric Radiology');

CREATE TABLE telerady.document (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL
);
insert into telerady.document (name, name_en) values ('Titulo Especialista', 'Specialist Title'), ('Certificado Colegiacion', 'Membership Certificate'), ('Certificado Alta Autonomo', 'certificate of self-employment'), ('DNI NIE', 'DNI NIE'), ('Seguro Responsabilidad Civil', 'Civil Liability Insurance'), ('Certificado Bancario', 'Bank Certificate'), ('Firma', 'Signature');

CREATE TABLE telerady.report_states (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    name_en VARCHAR(100) NOT NULL
);
insert into telerady.report_states (name, name_en) values ('Pendiente', 'Pending'), ('En revisión', 'Under review'), ('Finalizado', 'Completed');

--> ************USER CANDIDATE****************
CREATE TABLE telerady.professional (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name VARCHAR(100) NOT NULL,  
    last_name VARCHAR(100) NOT NULL,
    city_residence VARCHAR(100) NOT NULL,
    title_status_id INTEGER,  --REFERENCES get_title_specialty(id),
    phone VARCHAR(20),
    email VARCHAR(150) UNIQUE NOT NULL,
    professional_license VARCHAR(50)
);

CREATE TABLE telerady.professional_subspecialty (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID, --REFERENCES telerady.professional(id),
    subspecialty_id INTEGER NOT NULL --REFERENCES telerady.subspecialty(id)
);

CREATE TABLE telerady.professional_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    professional_id UUID, --REFERENCES telerady.professional(id),
    document_id INTEGER NOT NULL, --REFERENCES telerady.document(id),
    name_document VARCHAR(150) DEFAULT NULL,
    drive_id VARCHAR(50) DEFAULT NULL
);

CREATE TABLE telerady.freelancer_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID, --REFERENCES telerady.professional(id), 
    registration_number VARCHAR(50) NOT NULL, 
    bank_account VARCHAR(50) NOT NULL 
);

CREATE TABLE telerady.professional_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID, --REFERENCES telerady.professional(id),
    available_days VARCHAR(255),
    available_times VARCHAR(255)  
);

CREATE TABLE telerady.work_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID, --REFERENCES telerady.professional(id),
    working_modality_id INTEGER, --REFERENCES modality(id),
    salary_expectation_id DECIMAL(10,2) NOT NULL, 
    contract_type INTEGER --REFERENCES contract(id)
);

CREATE TABLE telerady.report_study (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL, --REFERENCES telerady.professional(id),
    study_iuid VARCHAR(150) NOT NULL,
    study_desc VARCHAR(150) NOT NULL,
    pat_id VARCHAR(150) NOT NULL,
    pat_name VARCHAR(150) NOT NULL,
    sex VARCHAR(150) NOT NULL,
    pat_birthdate VARCHAR(150) NOT NULL,
    modalities VARCHAR(50)[],
    institution VARCHAR(150) NOT NULL,
    src VARCHAR(150) NOT NULL,
    study_created_time TIMESTAMPTZ DEFAULT NULL,
    report_state_id INT NOT NULL, -- REFERENCES telerady.report_states(id),
    report_registered_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    report_sent_time TIMESTAMPTZ DEFAULT NULL,
    report_id_api VARCHAR(150)
);

CREATE TABLE telerady.event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,   -- Ej: 'report_start', 'report_view_img', 'report_generate_ia', 'report_finalize'
    event_payload JSONB NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only audit log with SHA-256 hash chain. Inserts only; modifications
-- and deletions are blocked by a trigger to keep the chain verifiable.
CREATE TABLE telerady.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id UUID,
    actor_role VARCHAR(50),
    hospital_id UUID,
    action VARCHAR(100) NOT NULL,
    target_kind VARCHAR(50) NOT NULL,
    target_id VARCHAR(150),
    payload JSONB NOT NULL,
    prev_hash VARCHAR(64),
    hash VARCHAR(64) NOT NULL,
    request_ip VARCHAR(45),
    request_ua VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON telerady.audit_log (ts);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON telerady.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS audit_log_hospital_idx ON telerady.audit_log (hospital_id);

CREATE OR REPLACE FUNCTION telerady.audit_log_block_modifications()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'telerady.audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON telerady.audit_log;
CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE OR DELETE OR TRUNCATE ON telerady.audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION telerady.audit_log_block_modifications();

-- =====================================================================
-- Sprint 1 — Multi-tenant model
-- =====================================================================

CREATE TABLE telerady.hospital (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    tax_id VARCHAR(50) UNIQUE,
    signature_policy VARCHAR(40) NOT NULL DEFAULT 'name_collegiate'
        CHECK (signature_policy IN ('name_collegiate', 'drawn_hash_tsa')),
    retention_days INTEGER NOT NULL DEFAULT 3650,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE telerady.app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    mfa_secret_enc TEXT,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    professional_id UUID REFERENCES telerady.professional(id) ON DELETE SET NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_user_lower_email_idx ON telerady.app_user (lower(email));

CREATE TABLE telerady.user_role_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES telerady.app_user(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL
        CHECK (role IN ('admin', 'coordinator', 'hospital_admin', 'hospital_user', 'radiologist')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

CREATE TABLE telerady.hospital_membership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES telerady.app_user(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES telerady.hospital(id) ON DELETE CASCADE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, hospital_id)
);

CREATE TABLE telerady.refresh_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES telerady.app_user(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_id UUID REFERENCES telerady.refresh_token(id) ON DELETE SET NULL,
    ip VARCHAR(45),
    ua VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_token_user_idx ON telerady.refresh_token (user_id);
CREATE INDEX refresh_token_expires_idx ON telerady.refresh_token (expires_at);

-- Extend report_study with hospital_id + encrypted columns. Legacy plaintext
-- columns are kept (nullable) until Sprint 2 retires the imported repos.
ALTER TABLE telerady.report_study
    ADD COLUMN hospital_id UUID REFERENCES telerady.hospital(id) ON DELETE SET NULL,
    ADD COLUMN pat_id_enc TEXT,
    ADD COLUMN pat_id_hash VARCHAR(64),
    ADD COLUMN pat_name_enc TEXT,
    ADD COLUMN pat_birthdate_enc TEXT,
    ALTER COLUMN pat_id DROP NOT NULL,
    ALTER COLUMN pat_name DROP NOT NULL,
    ALTER COLUMN pat_birthdate DROP NOT NULL;
CREATE INDEX report_study_hospital_idx ON telerady.report_study (hospital_id);
CREATE INDEX report_study_pat_id_hash_idx ON telerady.report_study (pat_id_hash);

ALTER TABLE telerady.freelancer_data
    ADD COLUMN bank_account_enc TEXT,
    ALTER COLUMN bank_account DROP NOT NULL;
