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