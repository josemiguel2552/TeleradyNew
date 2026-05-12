/**
 * Minimal HL7 v2 codec. Enough for ORM^O01 / ADT^A0x / ORU^R01 traffic;
 * we deliberately do NOT pull a full HL7 library in — the surface is too
 * big and most of it irrelevant for radiology.
 *
 * Encoding chars (HL7 §2.7): MSH-1=`|`, MSH-2=`^~\&`.
 *   Segments separated by `\r`.
 *   Fields separated by `|`.
 *   Components by `^`, repetitions by `~`, subcomponents by `&`.
 *
 * Escapes (HL7 §2.7.2): `\F\`=|, `\S\`=^, `\T\`=&, `\R\`=~, `\E\`=\, `\.br\`=newline.
 */

const SEGMENT_SEP = '\r';
const FIELD_SEP = '|';
const COMPONENT_SEP = '^';
const REPETITION_SEP = '~';
const SUBCOMPONENT_SEP = '&';

export interface Hl7Field {
  raw: string;
  /** repetitions of components of subcomponents */
  rep: string[][][];
}

export interface Hl7Segment {
  name: string;
  fields: Hl7Field[];
}

export interface Hl7Message {
  raw: string;
  segments: Hl7Segment[];
  /** Convenience lookup: `MSH`, `PID`, `ORC`, `OBR`, `OBX`… */
  byName: Map<string, Hl7Segment[]>;
}

export function parseHl7(raw: string): Hl7Message {
  const segments: Hl7Segment[] = [];
  const byName = new Map<string, Hl7Segment[]>();
  const lines = raw.replace(/\r\n|\n/g, '\r').split(SEGMENT_SEP);
  for (const line of lines) {
    if (!line) continue;
    const segName = line.slice(0, 3);
    if (segName.length !== 3 || !/^[A-Z][A-Z0-9]{2}$/.test(segName)) continue;
    const fieldsRaw = line.split(FIELD_SEP);
    // For MSH, field 1 is the field separator itself; shift accordingly.
    const fieldsStart = segName === 'MSH' ? 2 : 1;
    const fields: Hl7Field[] = [];
    // Prepend a placeholder so callers can do msh.fields[1] for MSH-1.
    if (segName === 'MSH') fields.push({ raw: FIELD_SEP, rep: [[[FIELD_SEP]]] });
    for (let i = fieldsStart - (segName === 'MSH' ? 1 : 1); i < fieldsRaw.length; i += 1) {
      const fraw = fieldsRaw[i];
      const reps = fraw.split(REPETITION_SEP).map((r) =>
        r.split(COMPONENT_SEP).map((c) => c.split(SUBCOMPONENT_SEP)),
      );
      fields.push({ raw: fraw, rep: reps });
    }
    const seg: Hl7Segment = { name: segName, fields };
    segments.push(seg);
    const list = byName.get(segName) ?? [];
    list.push(seg);
    byName.set(segName, list);
  }
  return { raw, segments, byName };
}

export function getField(seg: Hl7Segment, index: number): string {
  return seg.fields[index]?.raw ?? '';
}

export function getComponent(seg: Hl7Segment, fieldIdx: number, compIdx: number): string {
  return seg.fields[fieldIdx]?.rep[0]?.[compIdx]?.[0] ?? '';
}

export function buildMessage(segments: string[][]): string {
  return segments.map((seg) => seg.join(FIELD_SEP)).join(SEGMENT_SEP) + SEGMENT_SEP;
}

/**
 * Builds a MSA acknowledgement (HL7 §2.8.7) for a received message.
 * `ackCode` = `AA` (accept), `AE` (application error), `AR` (rejected).
 */
export function buildAck(
  incoming: Hl7Message,
  ackCode: 'AA' | 'AE' | 'AR',
  textMessage?: string,
  sendingApp = 'TELERADY',
  sendingFac = 'TELERADY',
): string {
  const msh = incoming.byName.get('MSH')?.[0];
  const receivingApp = msh ? getField(msh, 3) : '';
  const receivingFac = msh ? getField(msh, 4) : '';
  const controlId = msh ? getField(msh, 10) : '';
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .replace(/\..+$/, '');
  const ackSegments: string[][] = [
    [
      'MSH',
      '^~\\&',
      sendingApp,
      sendingFac,
      receivingApp,
      receivingFac,
      ts,
      '',
      'ACK',
      `ACK-${controlId}`,
      'P',
      '2.5',
    ],
    ['MSA', ackCode, controlId, textMessage ?? ''],
  ];
  return buildMessage(ackSegments);
}
