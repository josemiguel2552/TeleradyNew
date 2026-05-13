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

/**
 * Indexing convention (HL7 §2.7): `fields[0]` is the segment name and
 * `fields[i]` is the i-th HL7 field, so callers can write
 * `getField(pid, 3)` to read PID-3 and `getField(msh, 3)` to read
 * MSH-3 (sending application) uniformly.
 *
 * MSH carries two "synthetic" fields:
 *   MSH-1 = the field separator (always `|`)
 *   MSH-2 = the encoding characters (`^~\&`)
 * In the raw `|`-split these are at positions 0 and 1, so the rest of
 * the fields (MSH-3, MSH-4, …) live at fieldsRaw[2..end]. We
 * reconstruct the canonical indexing here.
 *
 * NOTE — Sprint 41 fix: the previous implementation was off-by-one on
 * MSH, so `getField(msh, 3)` was returning MSH-4 (sending facility)
 * instead of MSH-3 (sending application). hl7-mapper.ts and the ACK
 * builder were affected; the codec spec now pins the contract.
 */
export function parseHl7(raw: string): Hl7Message {
  const segments: Hl7Segment[] = [];
  const byName = new Map<string, Hl7Segment[]>();
  const lines = raw.replace(/\r\n|\n/g, '\r').split(SEGMENT_SEP);
  const wrapLiteral = (text: string): Hl7Field => ({
    raw: text,
    rep: [[[text]]],
  });
  for (const line of lines) {
    if (!line) continue;
    const segName = line.slice(0, 3);
    if (segName.length !== 3 || !/^[A-Z][A-Z0-9]{2}$/.test(segName)) continue;
    const fieldsRaw = line.split(FIELD_SEP);
    const fields: Hl7Field[] = [wrapLiteral(segName)];

    let rawStart: number;
    if (segName === 'MSH') {
      fields.push(wrapLiteral(FIELD_SEP));         // MSH-1
      fields.push(wrapLiteral(fieldsRaw[1] ?? '')); // MSH-2 = encoding chars
      rawStart = 2;
    } else {
      rawStart = 1;
    }

    for (let i = rawStart; i < fieldsRaw.length; i += 1) {
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
