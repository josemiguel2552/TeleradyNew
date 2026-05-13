import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { MetricsService } from '../../metrics/metrics.service';
import { MppsService } from './mpps.service';
import type { MppsEventDto } from './dto/mpps-event.dto';

jest.mock('../../database/drizzle', () => {
  // Each select chain is fed from a FIFO queue so callers can stage
  // the rows seen by each query. updates / inserts are recorded for
  // assertion.
  const limitQueue: unknown[] = [];
  const updates: any[] = [];
  const inserts: any[] = [];

  const select = jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(() => Promise.resolve(limitQueue.shift() ?? [])),
  }));

  const insertBuilder = {
    values: jest.fn((v: unknown) => {
      inserts.push(v);
      return {
        returning: jest.fn().mockResolvedValue([{ id: 'event-new-1' }]),
      };
    }),
  };

  const updateBuilder = {
    set: jest.fn((v: unknown) => {
      updates.push(v);
      return {
        where: jest.fn().mockResolvedValue(undefined),
      };
    }),
  };

  return {
    db: {
      transaction: jest.fn((cb: any) =>
        cb({
          select,
          insert: jest.fn(() => insertBuilder),
          update: jest.fn(() => updateBuilder),
        }),
      ),
      // Test helpers exposed for the suite.
      __limitQueue: limitQueue,
      __updates: updates,
      __inserts: inserts,
    },
  };
});

import { db } from '../../database/drizzle';

function queueRows(rows: unknown[][]) {
  const queue = (db as any).__limitQueue as unknown[];
  queue.length = 0;
  queue.push(...rows);
}
function resetSinks() {
  (db as any).__updates.length = 0;
  (db as any).__inserts.length = 0;
}

const baseEvent: MppsEventDto = {
  performedProcedureStepId: 'pps-001',
  status: 'IN PROGRESS',
  accessionNumber: 'ACC-001',
  studyInstanceUid: '1.2.3.4',
  modality: 'CT',
  stationName: 'CT-01',
  startDateTime: '2026-05-13T10:00:00Z',
};

describe('MppsService', () => {
  let service: MppsService;
  let audit: jest.Mocked<AuditLogService>;
  let enc: jest.Mocked<ColumnEncryptionService>;
  let metrics: any;

  beforeEach(async () => {
    audit = { append: jest.fn().mockResolvedValue(undefined) } as any;
    enc = {
      encrypt: jest.fn().mockReturnValue('gcm:v1:enc'),
    } as any;
    metrics = {
      mppsEvents: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MppsService,
        { provide: AuditLogService, useValue: audit },
        { provide: ColumnEncryptionService, useValue: enc },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();
    service = module.get(MppsService);
    jest.clearAllMocks();
    resetSinks();
  });

  it('creates a new event row when nothing matches and the PPS id is unseen', async () => {
    queueRows([
      [], // mwl lookup: no match
      [], // study lookup: no match
      [], // existing mpps_event lookup: none
    ]);
    const out = await service.ingest(baseEvent);
    expect(out.outcome).toBe('new');
    expect(out.mwlEntryId).toBeNull();
    expect(out.reportStudyId).toBeNull();
    expect((db as any).__inserts).toHaveLength(1);
    expect((db as any).__inserts[0].rawPayloadEnc).toBe('gcm:v1:enc');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'pacs.mpps_received',
        targetKind: 'MppsEvent',
        payload: expect.objectContaining({
          status: 'IN PROGRESS',
          accessionMatched: false,
          studyMatched: false,
          outcome: 'new',
        }),
      }),
      expect.anything(),
    );
  });

  it('joins to the existing MWL entry and updates its state', async () => {
    queueRows([
      [{ id: 'mwl-1', hospitalId: 'hosp-A' }], // mwl
      [], // study
      [], // existing event
    ]);
    const out = await service.ingest({ ...baseEvent, studyInstanceUid: undefined });
    expect(out.mwlEntryId).toBe('mwl-1');
    expect((db as any).__updates.find((u: any) => u.state === 'in_progress')).toBeTruthy();
  });

  it('joins to the existing report_study and surfaces it in the response', async () => {
    // accessionNumber is undefined so the mwl lookup is skipped — only
    // two queries hit the DB.
    queueRows([
      [{ id: 'rs-1', hospitalId: 'hosp-B' }], // study
      [], // existing event
    ]);
    const out = await service.ingest({ ...baseEvent, accessionNumber: undefined });
    expect(out.reportStudyId).toBe('rs-1');
  });

  it('upgrades the existing event row when a second N-SET arrives with the same PPS id', async () => {
    queueRows([
      [], // mwl
      [], // study
      [{ id: 'event-existing' }], // existing event
    ]);
    const out = await service.ingest({ ...baseEvent, status: 'COMPLETED', endDateTime: '2026-05-13T10:30:00Z' });
    expect(out.outcome).toBe('update');
    expect(out.eventId).toBe('event-existing');
    expect((db as any).__inserts).toHaveLength(0);
    expect((db as any).__updates.some((u: any) => u.status === 'COMPLETED')).toBe(true);
  });

  it('audits + bumps the metric labeled with the MPPS status', async () => {
    queueRows([[], [], []]);
    await service.ingest({ ...baseEvent, status: 'DISCONTINUED' });
    expect(metrics.mppsEvents.labels).toHaveBeenCalledWith('DISCONTINUED');
  });
});
