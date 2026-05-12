import { randomUUID } from 'node:crypto';

/**
 * Builds a minimal DICOM Basic Text Structured Report (TID 2000) for a
 * signed Telerady report. The output is a small JSON-DICOM model that
 * Orthanc accepts via the `/tools/create-dicom` endpoint, which is the
 * simplest way to push a SR without pulling a full DICOM toolkit.
 *
 * Hospitals that want the report embedded into their PACS get the SR
 * referencing the original Study; everyone else can ignore it.
 *
 * Reference: Orthanc Book — "Creating DICOM files from a JSON document".
 */
export interface SrBuilderInput {
  studyInstanceUid: string;
  patientId: string;
  patientName: string;
  patientBirthdate?: string;
  patientSex?: string;
  reportText: string;
  signedBy: string;
  signedAt: string;
  contentsDigest: string;
}

export interface OrthancCreateDicomBody {
  Tags: Record<string, string>;
  Content?: string;
}

export function buildBasicTextSr(input: SrBuilderInput): OrthancCreateDicomBody {
  const now = new Date(input.signedAt);
  const yyyy = now.getUTCFullYear().toString();
  const mm = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const dd = `${now.getUTCDate()}`.padStart(2, '0');
  const hh = `${now.getUTCHours()}`.padStart(2, '0');
  const mi = `${now.getUTCMinutes()}`.padStart(2, '0');
  const ss = `${now.getUTCSeconds()}`.padStart(2, '0');

  // Generate a fresh series + instance UID for the SR itself.
  const seriesUid = `${input.studyInstanceUid}.99.sr.${Date.now()}`;
  const instanceUid = `${seriesUid}.${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  return {
    Tags: {
      // Patient (DICOM Patient module)
      PatientID: input.patientId,
      PatientName: input.patientName,
      PatientBirthDate: input.patientBirthdate?.replace(/-/g, '') ?? '',
      PatientSex: input.patientSex ?? '',
      // General Study (binds the SR to the original imaging study)
      StudyInstanceUID: input.studyInstanceUid,
      StudyDate: `${yyyy}${mm}${dd}`,
      StudyTime: `${hh}${mi}${ss}`,
      // SR-specific (SOP class for Basic Text SR)
      SOPClassUID: '1.2.840.10008.5.1.4.1.1.88.11',
      SeriesInstanceUID: seriesUid,
      SOPInstanceUID: instanceUid,
      Modality: 'SR',
      ContentDate: `${yyyy}${mm}${dd}`,
      ContentTime: `${hh}${mi}${ss}`,
      // SR Document General
      InstanceNumber: '1',
      CompletionFlag: 'COMPLETE',
      VerificationFlag: 'VERIFIED',
      VerifyingObserverSequence: [
        {
          VerifyingObserverName: input.signedBy,
          VerificationDateTime: `${yyyy}${mm}${dd}${hh}${mi}${ss}`,
          VerifyingOrganization: 'Telerady',
        },
      ] as unknown as string,
      // Content (text body)
      ValueType: 'TEXT',
      ConceptNameCodeSequence: [
        {
          CodeValue: '11526-1',
          CodingSchemeDesignator: 'LN',
          CodeMeaning: 'Radiology Report',
        },
      ] as unknown as string,
      TextValue: `${input.reportText}\n---\nDigest: ${input.contentsDigest}`,
    },
  };
}
