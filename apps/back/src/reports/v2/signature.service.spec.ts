import { BadRequestException } from '@nestjs/common';

// SignatureService imports ./report-v2.repository for types and
// ../../database/drizzle for the default db pool, which crashes at
// import-time without DATABASE_URL. We mock it before the SUT loads.
jest.mock('../../database/drizzle', () => ({
  db: {},
}));

import { SignatureService } from './signature.service';
import { TsaService, type TsaStamp } from './tsa.service';
import type { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import type { StorageService } from '../../integrations/storage/storage.service';
import type { ReportRow } from './report-v2.repository';
import type { SignReportDto } from './dto/sign-report.dto';

const PROFESSIONAL_ROW = {
  name: 'Pepa',
  lastName: 'Ramírez',
  professionalLicense: '12345',
};

function makeReport(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: 'rep-1',
    reportStudyId: 'study-1',
    hospitalId: 'hosp-1',
    professionalId: 'prof-1',
    version: 1,
    state: 'finalized',
    contents: { sections: [{ key: 'impression', title: 'Impression', body: 'Normal' }] },
    signatureData: null,
    pdfBucket: null,
    pdfKey: null,
    signedAt: null,
    sentAt: null,
    ...overrides,
  } as ReportRow;
}

function makeDbStub(professional: typeof PROFESSIONAL_ROW | null) {
  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(professional ? [professional] : []),
  } as unknown as Parameters<SignatureService['sign']>[3];
}

function makeService(opts: {
  professional?: typeof PROFESSIONAL_ROW | null;
  storage?: Partial<StorageService>;
  tsa?: Partial<TsaService>;
} = {}) {
  const enc = {} as ColumnEncryptionService;
  const storage = {
    put: jest.fn().mockResolvedValue({ bucket: 'reports', key: 'signatures/rep-1/v1.png' }),
    ...opts.storage,
  } as unknown as StorageService;
  const tsa = {
    stamp: jest.fn().mockResolvedValue({
      provider: 'mock:internal',
      hashAlgorithm: 'sha256',
      hash: 'aa',
      ts: '2026-01-01T00:00:00.000Z',
      token: 'tk',
    } satisfies TsaStamp),
    ...opts.tsa,
  } as unknown as TsaService;
  const service = new SignatureService(enc, storage, tsa);
  const db = makeDbStub(opts.professional === undefined ? PROFESSIONAL_ROW : opts.professional);
  return { service, storage, tsa, db };
}

describe('SignatureService', () => {
  it('rejects a policy that does not match the hospital policy', async () => {
    const { service, db } = makeService();
    const dto = { policy: 'drawn_hash_tsa' } as SignReportDto;
    await expect(service.sign('name_collegiate', makeReport(), dto, db)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects sign() when the professional has no displayed name + collegiate', async () => {
    const { service, db } = makeService({
      professional: { name: '', lastName: '', professionalLicense: '' },
    });
    const dto = { policy: 'name_collegiate' } as SignReportDto;
    await expect(service.sign('name_collegiate', makeReport(), dto, db)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns a name_collegiate signature with contentsDigest', async () => {
    const { service, db, storage, tsa } = makeService();
    const dto = { policy: 'name_collegiate' } as SignReportDto;
    const result = await service.sign('name_collegiate', makeReport(), dto, db);
    expect(result.signatureData).toMatchObject({
      policy: 'name_collegiate',
      displayedName: 'Pepa Ramírez',
      collegiate: '12345',
    });
    expect(typeof result.signatureData['contentsDigest']).toBe('string');
    expect(result.signatureData['contentsDigest']).toHaveLength(64);
    expect(storage.put).not.toHaveBeenCalled();
    expect(tsa.stamp).not.toHaveBeenCalled();
  });

  it('overrides displayedName + collegiate from dto when provided', async () => {
    const { service, db } = makeService();
    const dto = {
      policy: 'name_collegiate',
      displayedName: 'Dr Override',
      collegiate: 'OV-1',
    } as SignReportDto;
    const result = await service.sign('name_collegiate', makeReport(), dto, db);
    expect(result.signatureData).toMatchObject({
      displayedName: 'Dr Override',
      collegiate: 'OV-1',
    });
  });

  it('rejects drawn_hash_tsa when the drawn payload is missing', async () => {
    const { service, db } = makeService();
    const dto = { policy: 'drawn_hash_tsa' } as SignReportDto;
    await expect(service.sign('drawn_hash_tsa', makeReport(), dto, db)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('stores the PNG, stamps the bundle and returns drawn_hash_tsa signatureData', async () => {
    const { service, db, storage, tsa } = makeService();
    const pngBase64 = Buffer.from('fake-png-bytes').toString('base64');
    const dto = {
      policy: 'drawn_hash_tsa',
      drawn: { drawingBase64: pngBase64 },
    } as SignReportDto;

    const result = await service.sign('drawn_hash_tsa', makeReport(), dto, db);

    expect(storage.put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'signatures/rep-1/v1.png',
        bucket: 'reports',
        contentType: 'image/png',
      }),
    );
    expect(tsa.stamp).toHaveBeenCalledTimes(1);
    expect(result.signatureData).toMatchObject({
      policy: 'drawn_hash_tsa',
      drawingBucket: 'reports',
      drawingKey: 'signatures/rep-1/v1.png',
      signedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.signatureData['tsa']).toMatchObject({ token: 'tk' });
  });
});
