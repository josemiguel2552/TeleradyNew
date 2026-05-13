import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiDraftService } from './ai-draft.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { MetricsService } from '../../metrics/metrics.service';
import { RadiogenAIClient } from '../../integrations/radiogenai/radiogenai.client';
import { Role } from '../../auth/roles';
import { db } from '../../database/drizzle';

jest.mock('../../database/drizzle', () => {
  const limitQueue: unknown[] = [];
  const builder = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(() => Promise.resolve(limitQueue.shift() ?? [])),
  };
  const updateBuilder = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(undefined),
  };
  return {
    db: {
      select: jest.fn(() => builder),
      update: jest.fn(() => updateBuilder),
      __limitQueue: limitQueue,
    },
  };
});

const STUDY_ROW = {
  id: 'study-1',
  hospitalId: 'h-1',
  professionalId: 'prof-1',
};

const user = {
  id: 'user-1',
  email: 'rad@example.com',
  roles: [Role.Radiologist],
  hospitalIds: ['h-1'],
  hospitalId: 'h-1',
  professionalId: 'prof-1',
  mfa: true,
} as any;

function queueRows(rows: unknown[][]) {
  const queue = (db as any).__limitQueue as unknown[];
  queue.length = 0;
  queue.push(...rows);
}

describe('AiDraftService', () => {
  let service: AiDraftService;
  let client: jest.Mocked<RadiogenAIClient>;
  let audit: jest.Mocked<AuditLogService>;
  let metrics: MetricsService;

  beforeEach(async () => {
    client = {
      configured: true,
      generate: jest.fn(),
      generateStream: jest.fn(),
    } as unknown as jest.Mocked<RadiogenAIClient>;
    audit = { append: jest.fn().mockResolvedValue(undefined) } as any;
    metrics = {
      aiDraftRequests: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
      aiDraftLatency: { observe: jest.fn() },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiDraftService,
        { provide: RadiogenAIClient, useValue: client },
        { provide: AuditLogService, useValue: audit },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    service = module.get(AiDraftService);
    jest.clearAllMocks();
  });

  it('responds 503 when RADIOGENAI_URL is not configured', async () => {
    (client as any).configured = false;
    await expect(
      service.generate('study-1', { findings: 'long enough findings text', reportTitle: 'CT' }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects when findings are below the minimum length', async () => {
    await expect(
      service.generate('study-1', { findings: 'tiny', reportTitle: 'CT' }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects when the hospital has not opted in to AI drafting', async () => {
    queueRows([
      [STUDY_ROW], // study
      [{ aiDraftingAllowed: false }], // hospital
    ]);
    await expect(
      service.generate(
        'study-1',
        { findings: 'enough findings text here', reportTitle: 'CT' },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.generate).not.toHaveBeenCalled();
  });

  it('rejects on first call without explicit consent', async () => {
    queueRows([
      [STUDY_ROW],
      [{ aiDraftingAllowed: true }],
      [{ aiConsentAt: null }], // never consented
    ]);
    await expect(
      service.generate(
        'study-1',
        { findings: 'enough findings text here', reportTitle: 'CT' },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.generate).not.toHaveBeenCalled();
  });

  it('records consent on first acceptance and forwards to RadiogenAI', async () => {
    queueRows([
      [STUDY_ROW],
      [{ aiDraftingAllowed: true }],
      [{ aiConsentAt: null }],
    ]);
    client.generate.mockResolvedValue({ text: 'IA draft', latencyMs: 1234, charCount: 8 });

    const out = await service.generate(
      'study-1',
      {
        findings: 'enough findings text here',
        reportTitle: 'CT',
        language: 'es',
        acceptConsent: true,
      },
      user,
    );

    expect(client.generate).toHaveBeenCalledWith({
      findings: 'enough findings text here',
      reportTitle: 'CT',
      language: 'es',
    });
    // The user-row update was issued
    expect((db as any).update).toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.ai_draft_requested',
        targetKind: 'Report',
        targetId: 'study-1',
        hospitalId: 'h-1',
        payload: expect.objectContaining({
          provider: 'radiogenai',
          findingsChars: 'enough findings text here'.length,
          responseChars: 8,
          latencyMs: 1234,
          language: 'es',
        }),
      }),
    );
    expect(out.text).toBe('IA draft');
  });

  it('skips consent UPDATE when the user has already accepted', async () => {
    queueRows([
      [STUDY_ROW],
      [{ aiDraftingAllowed: true }],
      [{ aiConsentAt: '2026-01-01T00:00:00Z' }],
    ]);
    client.generate.mockResolvedValue({ text: 'IA draft', latencyMs: 10, charCount: 8 });

    await service.generate(
      'study-1',
      { findings: 'enough findings text here', reportTitle: 'CT' },
      user,
    );
    expect((db as any).update).not.toHaveBeenCalled();
    expect(client.generate).toHaveBeenCalled();
  });

  it('rejects a radiologist who is not the assigned reader of the study', async () => {
    queueRows([
      [{ ...STUDY_ROW, professionalId: 'someone-else' }],
    ]);
    await expect(
      service.generate(
        'study-1',
        { findings: 'enough findings text here', reportTitle: 'CT' },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('generateStream', () => {
    it('rejects on the gate before opening the stream', async () => {
      queueRows([
        [STUDY_ROW],
        [{ aiDraftingAllowed: false }], // hospital opt-out
      ]);
      const iter = service.generateStream(
        'study-1',
        { findings: 'enough findings text here', reportTitle: 'CT' },
        user,
      );
      await expect(iter.next()).rejects.toBeInstanceOf(ForbiddenException);
      expect(client.generateStream).not.toHaveBeenCalled();
      expect(audit.append).not.toHaveBeenCalled();
    });

    it('streams chunks and audits with the final summary on success', async () => {
      queueRows([
        [STUDY_ROW],
        [{ aiDraftingAllowed: true }],
        [{ aiConsentAt: '2026-01-01T00:00:00Z' }],
      ]);
      // Simulate the client emitting two chunks then closing.
      (client.generateStream as jest.Mock).mockImplementation(
        async function* (_req: unknown, onClose: any) {
          yield { text: 'hola' };
          yield { text: '\nmundo' };
          onClose({ latencyMs: 250, charCount: 10 });
        },
      );

      const chunks: string[] = [];
      for await (const c of service.generateStream(
        'study-1',
        { findings: 'enough findings text here', reportTitle: 'CT' },
        user,
      )) {
        chunks.push(c.text);
      }
      expect(chunks).toEqual(['hola', '\nmundo']);
      expect(audit.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'report.ai_draft_requested',
          payload: expect.objectContaining({
            provider: 'radiogenai',
            outcome: 'ok',
            responseChars: 10,
            latencyMs: 250,
          }),
        }),
      );
      expect(metrics.aiDraftRequests.labels).toHaveBeenCalledWith('ok');
    });

    it('audits with outcome=error when the upstream fails mid-stream', async () => {
      queueRows([
        [STUDY_ROW],
        [{ aiDraftingAllowed: true }],
        [{ aiConsentAt: '2026-01-01T00:00:00Z' }],
      ]);
      (client.generateStream as jest.Mock).mockImplementation(
        async function* (_req: unknown, onClose: any) {
          yield { text: 'hola' };
          onClose({ latencyMs: 30, charCount: 4 });
          throw new Error('connection lost');
        },
      );

      await expect(
        (async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const _ of service.generateStream(
            'study-1',
            { findings: 'enough findings text here', reportTitle: 'CT' },
            user,
          )) {
            /* drain */
          }
        })(),
      ).rejects.toThrow(/connection lost/);

      expect(audit.append).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            outcome: 'error',
            responseChars: 4,
          }),
        }),
      );
      expect(metrics.aiDraftRequests.labels).toHaveBeenCalledWith('error');
    });
  });
});
