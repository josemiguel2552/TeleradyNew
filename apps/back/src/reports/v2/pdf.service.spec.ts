jest.mock('../../database/drizzle', () => ({ db: {} }));

import { PdfService } from './pdf.service';
import type { StorageService } from '../../integrations/storage/storage.service';
import type { ReportRow } from './report-v2.repository';

function makeReport(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: 'rep-1',
    reportStudyId: 'study-1',
    hospitalId: 'hosp-1',
    professionalId: 'prof-1',
    version: 2,
    state: 'signed',
    contents: {
      sections: [
        { key: 'findings', title: 'Hallazgos', body: 'Sin alteraciones significativas.' },
        { key: 'impression', title: 'Impresión', body: 'Normal.' },
      ],
    },
    signatureData: null,
    pdfBucket: null,
    pdfKey: null,
    signedAt: '2026-05-10T10:00:00.000Z',
    sentAt: null,
    ...overrides,
  } as ReportRow;
}

function makeService() {
  const storage = {
    put: jest.fn().mockImplementation(async ({ bucket, key }) => ({ bucket, key })),
  } as unknown as StorageService;
  return { service: new PdfService(storage), storage };
}

describe('PdfService', () => {
  it('renders a non-empty PDF buffer and uploads it under reports/<study>/v<n>.pdf', async () => {
    const { service, storage } = makeService();
    const report = makeReport();
    const out = await service.render(report, { name: 'María García', birthdate: '1985-04-23' });

    expect(out).toEqual({
      bucket: 'reports',
      key: 'reports/study-1/v2.pdf',
      sizeBytes: expect.any(Number),
    });
    expect(out.sizeBytes).toBeGreaterThan(0);

    expect(storage.put).toHaveBeenCalledTimes(1);
    const args = (storage.put as jest.Mock).mock.calls[0][0];
    expect(args.bucket).toBe('reports');
    expect(args.contentType).toBe('application/pdf');
    expect(args.key).toBe('reports/study-1/v2.pdf');
    expect(args.metadata).toEqual({ reportId: 'rep-1', version: '2' });
    expect(Buffer.isBuffer(args.body)).toBe(true);
    expect((args.body as Buffer).slice(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('renders an "empty" placeholder when contents has no sections', async () => {
    const { service, storage } = makeService();
    await service.render(makeReport({ contents: { sections: [] } }), {
      name: 'Juan Pérez',
      birthdate: null,
    });
    const buf = (storage.put as jest.Mock).mock.calls[0][0].body as Buffer;
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('omits the signature block when signatureData is null', async () => {
    const { service, storage } = makeService();
    await service.render(makeReport({ signatureData: null }), {
      name: 'Anon',
      birthdate: null,
    });
    expect(storage.put).toHaveBeenCalledTimes(1);
  });

  it('writes the TSA footer when policy is drawn_hash_tsa', async () => {
    const { service, storage } = makeService();
    const report = makeReport({
      signatureData: {
        policy: 'drawn_hash_tsa',
        displayedName: 'Pepa Ramírez',
        collegiate: '12345',
        contentsDigest: 'a'.repeat(64),
        tsa: { provider: 'mock:internal', ts: '2026-05-10T10:00:00Z', token: 'b'.repeat(64) },
      },
    });
    await service.render(report, { name: 'María', birthdate: null });
    const buf = (storage.put as jest.Mock).mock.calls[0][0].body as Buffer;
    // pdfkit produces deflate-compressed streams, so we cannot grep the text.
    // What we can assert is that the drawn_hash_tsa branch adds *more bytes*
    // than the same report with no signature block.
    const { service: bare, storage: bareStorage } = makeService();
    await bare.render(makeReport({ signatureData: null }), { name: 'María', birthdate: null });
    const bareBuf = (bareStorage.put as jest.Mock).mock.calls[0][0].body as Buffer;
    expect(buf.length).toBeGreaterThan(bareBuf.length);
  });

  it('writes a shorter signature block for name_collegiate (no TSA)', async () => {
    const { service: a, storage: sa } = makeService();
    const { service: b, storage: sb } = makeService();
    await a.render(
      makeReport({
        signatureData: {
          policy: 'name_collegiate',
          displayedName: 'Pepa Ramírez',
          collegiate: '12345',
        },
      }),
      { name: 'María', birthdate: null },
    );
    await b.render(
      makeReport({
        signatureData: {
          policy: 'drawn_hash_tsa',
          displayedName: 'Pepa Ramírez',
          collegiate: '12345',
          contentsDigest: 'c'.repeat(64),
          tsa: { provider: 'mock:internal', ts: '2026-05-10T10:00:00Z', token: 'd'.repeat(64) },
        },
      }),
      { name: 'María', birthdate: null },
    );
    const aBuf = (sa.put as jest.Mock).mock.calls[0][0].body as Buffer;
    const bBuf = (sb.put as jest.Mock).mock.calls[0][0].body as Buffer;
    expect(aBuf.length).toBeLessThan(bBuf.length);
  });
});
