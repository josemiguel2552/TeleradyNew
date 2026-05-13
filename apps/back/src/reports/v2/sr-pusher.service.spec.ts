const limitMock = jest.fn();
jest.mock('../../database/drizzle', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: limitMock,
        }),
      }),
    }),
  },
}));

const buildBasicTextSrMock: jest.Mock = jest.fn(() => ({ kind: 'fake-sr-json' }));
jest.mock('../../integrations/orthanc/dicom-sr-builder', () => ({
  buildBasicTextSr: (arg: unknown) => buildBasicTextSrMock(arg),
}));

import { SrPusherService } from './sr-pusher.service';
import type { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import type { OrthancClient } from '../../integrations/orthanc/orthanc-client.service';
import type { ReportRow } from './report-v2.repository';

function makeReport(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: 'rep-1',
    reportStudyId: 'study-1',
    hospitalId: 'hosp-1',
    professionalId: 'prof-1',
    version: 1,
    state: 'signed',
    contents: {
      sections: [
        { key: 'findings', title: 'Hallazgos', body: 'Sin alteraciones.' },
        { key: 'impression', title: 'Impresión', body: 'Normal.' },
      ],
    },
    signatureData: {
      displayedName: 'Pepa Ramírez',
      contentsDigest: 'a'.repeat(64),
    },
    pdfBucket: null,
    pdfKey: null,
    signedAt: '2026-05-10T10:00:00.000Z',
    sentAt: null,
    ...overrides,
  } as ReportRow;
}

const STUDY_ROW = {
  studyIuid: '1.2.3',
  professionalId: 'prof-1',
  patIdEnc: 'enc-id',
  patNameEnc: 'enc-name',
  patBirthdateEnc: 'enc-birth',
  sex: 'F',
};

function makeService(opts: {
  enc?: Partial<ColumnEncryptionService>;
  orthanc?: Partial<OrthancClient>;
} = {}) {
  const enc = {
    decryptIfPresent: jest.fn((value: string | null) =>
      value == null ? null : `dec(${value})`,
    ),
    ...opts.enc,
  } as unknown as ColumnEncryptionService;
  const orthanc = {
    pushDicomFromJson: jest.fn().mockResolvedValue({ id: 'orthanc-uuid' }),
    ...opts.orthanc,
  } as unknown as OrthancClient;
  return { service: new SrPusherService(enc, orthanc), enc, orthanc };
}

describe('SrPusherService', () => {
  beforeEach(() => {
    limitMock.mockReset();
    buildBasicTextSrMock.mockClear();
  });

  it('returns { orthancId: null } when the study lookup is empty', async () => {
    limitMock.mockResolvedValue([]);
    const { service, orthanc } = makeService();
    const out = await service.pushFor(makeReport());
    expect(out).toEqual({ orthancId: null });
    expect(orthanc.pushDicomFromJson).not.toHaveBeenCalled();
  });

  it('decrypts patient columns and forwards the SR JSON to Orthanc', async () => {
    limitMock.mockResolvedValue([STUDY_ROW]);
    const { service, enc, orthanc } = makeService();
    const out = await service.pushFor(makeReport());
    expect(out).toEqual({ orthancId: 'orthanc-uuid' });
    expect(enc.decryptIfPresent).toHaveBeenCalledWith('enc-id', 'report_study:prof-1');
    expect(buildBasicTextSrMock).toHaveBeenCalledTimes(1);
    const args = buildBasicTextSrMock.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(args.studyInstanceUid).toBe('1.2.3');
    expect(args.patientId).toBe('dec(enc-id)');
    expect(args.patientName).toBe('dec(enc-name)');
    expect(args.patientBirthdate).toBe('dec(enc-birth)');
    expect(args.signedBy).toBe('Pepa Ramírez');
    expect(args.signedAt).toBe('2026-05-10T10:00:00.000Z');
    expect(args.reportText).toContain('HALLAZGOS\nSin alteraciones.');
    expect(args.reportText).toContain('IMPRESIÓN\nNormal.');
    expect(orthanc.pushDicomFromJson).toHaveBeenCalledWith({ kind: 'fake-sr-json' });
  });

  it('falls back to UNKNOWN / Telerady / now when fields are null', async () => {
    limitMock.mockResolvedValue([
      { ...STUDY_ROW, patIdEnc: null, patNameEnc: null, patBirthdateEnc: null, sex: null },
    ]);
    const { service } = makeService({
      enc: { decryptIfPresent: jest.fn().mockReturnValue(null) } as Partial<ColumnEncryptionService>,
    });
    const out = await service.pushFor(
      makeReport({ contents: null, signatureData: null, signedAt: null }),
    );
    expect(out.orthancId).toBe('orthanc-uuid');
    const args = buildBasicTextSrMock.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(args.patientId).toBe('UNKNOWN');
    expect(args.patientName).toBe('UNKNOWN^');
    expect(args.patientBirthdate).toBeUndefined();
    expect(args.patientSex).toBeUndefined();
    expect(args.signedBy).toBe('Telerady');
    expect(args.reportText).toBe('');
    // signedAt falls back to "now" — assert it parses as a valid ISO timestamp.
    expect(Number.isNaN(Date.parse(args.signedAt as string))).toBe(false);
  });

  it('returns { orthancId: null } when Orthanc rejects the SR', async () => {
    limitMock.mockResolvedValue([STUDY_ROW]);
    const { service } = makeService({
      orthanc: {
        pushDicomFromJson: jest.fn().mockResolvedValue(null),
      } as Partial<OrthancClient>,
    });
    const out = await service.pushFor(makeReport());
    expect(out).toEqual({ orthancId: null });
  });

  it('swallows exceptions and returns { orthancId: null }', async () => {
    limitMock.mockRejectedValue(new Error('db boom'));
    const { service } = makeService();
    const out = await service.pushFor(makeReport());
    expect(out).toEqual({ orthancId: null });
  });
});
