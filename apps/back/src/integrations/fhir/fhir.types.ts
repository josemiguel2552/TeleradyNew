/**
 * Minimal FHIR R4 resource type definitions used by the adapter.
 *
 * Telerady does not aim to be a full FHIR server. We expose just the
 * resources hospitals ask for in RFPs: Patient, ImagingStudy and
 * DiagnosticReport — read endpoints scoped by tenant, plus a write
 * endpoint for DiagnosticReport that hospitals can use to pull reports
 * directly into their HIS.
 */

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirIdentifier {
  system?: string;
  value?: string;
}

export interface FhirHumanName {
  family?: string;
  given?: string[];
  text?: string;
}

export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  identifier?: FhirIdentifier[];
  name?: FhirHumanName[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}

export interface FhirImagingStudySeries {
  uid: string;
  modality: FhirCoding;
  description?: string;
  numberOfInstances?: number;
}

export interface FhirImagingStudy {
  resourceType: 'ImagingStudy';
  id: string;
  identifier?: FhirIdentifier[];
  status: 'registered' | 'available' | 'cancelled' | 'entered-in-error' | 'unknown';
  subject: FhirReference;
  started?: string;
  modality?: FhirCoding[];
  description?: string;
  series?: FhirImagingStudySeries[];
}

export interface FhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id: string;
  identifier?: FhirIdentifier[];
  status:
    | 'registered'
    | 'partial'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'appended'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FhirReference[];
  imagingStudy?: FhirReference[];
  conclusion?: string;
  presentedForm?: { contentType: string; url: string; title?: string }[];
}

export interface FhirBundle<T> {
  resourceType: 'Bundle';
  id: string;
  type: 'searchset';
  total: number;
  entry: Array<{ fullUrl?: string; resource: T }>;
}

export interface FhirOperationOutcomeIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  diagnostics?: string;
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: FhirOperationOutcomeIssue[];
}
