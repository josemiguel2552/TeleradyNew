import {
  buildAck,
  buildMessage,
  getComponent,
  getField,
  parseHl7,
} from './hl7-codec';

const SAMPLE_ORM =
  'MSH|^~\\&|HOSPITAL_RIS|HX|TELERADY|TELERADY|20260513120000||ORM^O01|MSG-1|P|2.5\r' +
  'PID|1||PAT-001||García^María||19800101|F\r' +
  'ORC|NW|ORD-1|ACC-001\r' +
  'OBR|1|ORD-1|ACC-001|CT-BRAIN^CT cráneo|||20260513120000||||||||||||||||||||||S|||||CT';

describe('hl7-codec.parseHl7', () => {
  it('splits the message into named segments', () => {
    const msg = parseHl7(SAMPLE_ORM);
    expect(msg.segments.map((s) => s.name)).toEqual(['MSH', 'PID', 'ORC', 'OBR']);
    expect(msg.byName.get('MSH')).toHaveLength(1);
    expect(msg.byName.get('PID')).toHaveLength(1);
  });

  it('normalises CRLF and LF to CR before splitting', () => {
    const crlf = SAMPLE_ORM.replace(/\r/g, '\r\n');
    expect(parseHl7(crlf).segments).toHaveLength(4);
    const lf = SAMPLE_ORM.replace(/\r/g, '\n');
    expect(parseHl7(lf).segments).toHaveLength(4);
  });

  it('skips lines that are not a valid 3-letter segment header', () => {
    const broken = 'garbage\r' + SAMPLE_ORM;
    expect(parseHl7(broken).segments).toHaveLength(4);
  });
});

describe('hl7-codec.getField / getComponent', () => {
  const msg = parseHl7(SAMPLE_ORM);
  const pid = msg.byName.get('PID')![0];
  const orc = msg.byName.get('ORC')![0];

  it('returns the raw field text', () => {
    expect(getField(pid, 3)).toBe('PAT-001');
    expect(getField(orc, 3)).toBe('ACC-001');
  });

  it('returns empty string when the index is out of range', () => {
    expect(getField(pid, 99)).toBe('');
    expect(getComponent(pid, 99, 0)).toBe('');
  });

  it('extracts components inside repetitions', () => {
    // PID-5 is "García^María"; component 0 = last name, 1 = first name.
    expect(getComponent(pid, 5, 0)).toBe('García');
    expect(getComponent(pid, 5, 1)).toBe('María');
  });
});

describe('hl7-codec.buildMessage / buildAck', () => {
  it('joins segments with CR and ends with CR (HL7 §2.7)', () => {
    const out = buildMessage([['MSH', '^~\\&', 'A', 'B', 'C', 'D'], ['MSA', 'AA', '1']]);
    expect(out.endsWith('\r')).toBe(true);
    expect(out.split('\r').filter(Boolean)).toEqual([
      'MSH|^~\\&|A|B|C|D',
      'MSA|AA|1',
    ]);
  });

  it('buildAck flips sender/receiver and echoes the control id', () => {
    const incoming = parseHl7(SAMPLE_ORM);
    const ack = buildAck(incoming, 'AA');
    // Sender becomes TELERADY/TELERADY, receiver becomes HOSPITAL_RIS/HX.
    expect(ack).toMatch(/^MSH\|\^~\\&\|TELERADY\|TELERADY\|HOSPITAL_RIS\|HX\|/);
    expect(ack).toContain('|ACK|ACK-MSG-1|');
    expect(ack).toContain('\rMSA|AA|MSG-1|');
  });

  it('buildAck supports AE/AR with optional text message', () => {
    const ack = buildAck(parseHl7(SAMPLE_ORM), 'AE', 'malformed');
    expect(ack).toContain('\rMSA|AE|MSG-1|malformed');
  });

  it('buildAck is resilient to a missing MSH', () => {
    const ack = buildAck({ raw: '', segments: [], byName: new Map() }, 'AR');
    // Receiver fields empty, no control id.
    expect(ack).toContain('|ACK|ACK-|');
  });
});
