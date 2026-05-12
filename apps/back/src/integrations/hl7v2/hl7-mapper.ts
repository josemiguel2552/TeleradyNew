import { getField, getComponent, type Hl7Message } from './hl7-codec';

export interface OrmOrder {
  controlId: string;
  sendingApplication: string;
  sendingFacility: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  patientBirthdate: string;
  patientSex: string;
  modality: string;
  studyDescription: string;
  scheduledDate: string;
  scheduledTime: string;
  requestingPhysician: string;
  orderControl: string;
}

/**
 * Pulls the radiology-relevant fields out of an ORM^O01 / OMI^O23 message.
 * Returns null when the message is not an order.
 */
export function mapOrm(message: Hl7Message): OrmOrder | null {
  const msh = message.byName.get('MSH')?.[0];
  if (!msh) return null;
  const messageType = getComponent(msh, 9, 0);
  const triggerEvent = getComponent(msh, 9, 1);
  if (!['ORM', 'OMI', 'OMG'].includes(messageType)) return null;
  void triggerEvent;

  const pid = message.byName.get('PID')?.[0];
  const orc = message.byName.get('ORC')?.[0];
  const obr = message.byName.get('OBR')?.[0];
  if (!pid || !orc || !obr) return null;

  const sendingApplication = getField(msh, 3);
  const sendingFacility = getField(msh, 4);
  const controlId = getField(msh, 10);

  // PID-3 is the patient identifier list; PID-5 is the patient name.
  const patientId = getComponent(pid, 3, 0);
  const patientLast = getComponent(pid, 5, 0);
  const patientFirst = getComponent(pid, 5, 1);
  const patientName = `${patientLast}^${patientFirst}`.replace(/\^$/, '');
  const patientBirthdate = getField(pid, 7);
  const patientSex = getField(pid, 8);

  const accessionNumber = getField(orc, 3) || getField(obr, 3);
  const orderControl = getField(orc, 1);
  const requestingPhysician = getField(orc, 12) || getField(obr, 16);

  // OBR-4 = Universal service identifier; OBR-7 = observation date/time
  // (scheduled in ORM messages); OBR-24 = diagnostic service section ID
  // (the modality).
  const studyDescription = getComponent(obr, 4, 1) || getComponent(obr, 4, 0);
  const scheduled = getField(obr, 7);
  const scheduledDate = scheduled.slice(0, 8);
  const scheduledTime = scheduled.slice(8, 14);
  const modality = getField(obr, 24);

  return {
    controlId,
    sendingApplication,
    sendingFacility,
    accessionNumber,
    patientId,
    patientName,
    patientBirthdate,
    patientSex,
    modality,
    studyDescription,
    scheduledDate,
    scheduledTime,
    requestingPhysician,
    orderControl,
  };
}

/**
 * Builds an ORU^R01 (Unsolicited Observation Result) message describing a
 * signed report. Used by the outbound MLLP client.
 *
 * Input shape mirrors what ReportV2Service has available at `send()` time
 * — the caller assembles it before handing it over.
 */
export interface OruInput {
  controlId: string;
  receivingApplication: string;
  receivingFacility: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  patientBirthdate: string;
  patientSex: string;
  studyDescription: string;
  observationDateTime: string;
  reportText: string;
  signedByDisplayedName: string;
  signedByCollegiate: string;
}

export function buildOruR01(input: OruInput, sendingApp = 'TELERADY', sendingFac = 'TELERADY'): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+$/, '');
  const segments: string[][] = [
    [
      'MSH',
      '^~\\&',
      sendingApp,
      sendingFac,
      input.receivingApplication,
      input.receivingFacility,
      ts,
      '',
      'ORU^R01',
      input.controlId,
      'P',
      '2.5',
    ],
    [
      'PID',
      '1',
      '',
      input.patientId,
      '',
      input.patientName,
      '',
      input.patientBirthdate,
      input.patientSex,
    ],
    ['ORC', 'RE', '', input.accessionNumber],
    [
      'OBR',
      '1',
      '',
      input.accessionNumber,
      `^${input.studyDescription}`,
      '',
      '',
      input.observationDateTime,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      `${input.signedByDisplayedName}^${input.signedByCollegiate}`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'F',
    ],
  ];

  // OBX repeating for each line of the report (limit field length to keep
  // segments small).
  input.reportText.split(/\r?\n/).forEach((line, idx) => {
    segments.push(['OBX', String(idx + 1), 'TX', 'REPORT^Report Text', '', line.slice(0, 1000)]);
  });

  return segments.map((s) => s.join('|')).join('\r') + '\r';
}
