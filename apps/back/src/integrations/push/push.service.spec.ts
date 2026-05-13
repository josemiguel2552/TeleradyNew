import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { MetricsService } from '../../metrics/metrics.service';

// `web-push` is mocked module-level so the suite never opens a socket.
jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  },
}));

jest.mock('../../database/drizzle', () => {
  const limitQueue: unknown[] = [];
  const inserts: any[] = [];
  const updates: any[] = [];

  const insertBuilder = {
    values: jest.fn(() => insertBuilder),
    onConflictDoUpdate: jest.fn(() => insertBuilder),
    returning: jest.fn(() =>
      Promise.resolve([
        { id: 'sub-1', createdAt: '2026-05-13T00:00:00Z', userAgent: 'jest' },
      ]),
    ),
  };

  // `.where()` returns a thenable so both bare `await db.select…where(…)`
  // and `await db.select…where(…).limit(1)` flow off the same queue.
  const select = jest.fn(() => {
    const next = {
      then: (resolve: any) => resolve(limitQueue.shift() ?? []),
      limit: jest.fn(() => Promise.resolve(limitQueue.shift() ?? [])),
    };
    return {
      from: jest.fn().mockReturnThis(),
      where: jest.fn(() => next),
    };
  });

  const updateBuilder = {
    set: jest.fn((v: unknown) => {
      updates.push(v);
      return { where: jest.fn().mockResolvedValue(undefined) };
    }),
  };

  return {
    db: {
      insert: jest.fn(() => {
        inserts.push({});
        return insertBuilder;
      }),
      select,
      update: jest.fn(() => updateBuilder),
      __limitQueue: limitQueue,
      __inserts: inserts,
      __updates: updates,
    },
  };
});

import { db } from '../../database/drizzle';
import webPush from 'web-push';
import { PushService } from './push.service';

function queueRows(rows: unknown[][]) {
  const queue = (db as any).__limitQueue as unknown[];
  queue.length = 0;
  queue.push(...rows);
}

function buildModule(env: Record<string, string | undefined>): Promise<TestingModule> {
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  return Test.createTestingModule({
    providers: [
      PushService,
      { provide: ConfigService, useValue: config },
      { provide: AuditLogService, useValue: { append: jest.fn().mockResolvedValue(undefined) } },
      {
        provide: MetricsService,
        useValue: {
          pushNotifications: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
        },
      },
    ],
  }).compile();
}

describe('PushService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db as any).__inserts.length = 0;
    (db as any).__updates.length = 0;
  });

  it('reports configured=false when VAPID env is missing and drops sends silently', async () => {
    const mod = await buildModule({});
    const service = mod.get(PushService);
    expect(service.configured).toBe(false);
    const result = await service.sendToUser('user-1', { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 0, reaped: 0, failed: 0 });
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('initialises web-push and exposes the public key when configured', async () => {
    const mod = await buildModule({
      VAPID_PUBLIC_KEY: 'B'.repeat(80),
      VAPID_PRIVATE_KEY: 'p'.repeat(40),
      VAPID_SUBJECT: 'mailto:ops@telerady.es',
    });
    const service = mod.get(PushService);
    expect(service.configured).toBe(true);
    expect(service.getPublicKey()).toBe('B'.repeat(80));
    expect(webPush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:ops@telerady.es',
      'B'.repeat(80),
      'p'.repeat(40),
    );
  });

  it('subscribe upserts the endpoint and returns the row id', async () => {
    const mod = await buildModule({
      VAPID_PUBLIC_KEY: 'B'.repeat(80),
      VAPID_PRIVATE_KEY: 'p'.repeat(40),
    });
    const service = mod.get(PushService);
    const out = await service.subscribe('user-1', {
      endpoint: 'https://fcm.googleapis.com/x',
      keys: { p256dh: 'p'.repeat(80), auth: 'a'.repeat(20) },
      userAgent: 'jest',
    });
    expect(out.id).toBe('sub-1');
    expect((db as any).__inserts).toHaveLength(1);
  });

  it('sendToUser delivers + reaps 410-gone subscriptions + audits', async () => {
    queueRows([
      [
        { id: 'sub-ok', endpoint: 'https://ok', p256dh: 'p', auth: 'a' },
        { id: 'sub-gone', endpoint: 'https://gone', p256dh: 'p', auth: 'a' },
      ],
    ]);
    (webPush.sendNotification as jest.Mock).mockImplementation((sub: any) => {
      if (sub.endpoint === 'https://gone') {
        const err = new Error('Gone') as Error & { statusCode?: number };
        err.statusCode = 410;
        return Promise.reject(err);
      }
      return Promise.resolve({});
    });

    const mod = await buildModule({
      VAPID_PUBLIC_KEY: 'B'.repeat(80),
      VAPID_PRIVATE_KEY: 'p'.repeat(40),
    });
    const audit = mod.get(AuditLogService) as jest.Mocked<AuditLogService>;
    const service = mod.get(PushService);

    const result = await service.sendToUser('user-1', {
      title: 'New study',
      body: 'CT cráneo asignado',
      category: 'study_assigned',
      url: '/radiologist/study/abc',
    });
    expect(result).toEqual({ delivered: 1, reaped: 1, failed: 0 });
    // gone subscription was soft-deleted.
    expect((db as any).__updates.some((u: any) => u.revokedAt !== undefined)).toBe(true);
    // audit row never carries title/body.
    const auditPayload = (audit.append as jest.Mock).mock.calls[0][0].payload;
    expect(auditPayload.title).toBeUndefined();
    expect(auditPayload.body).toBeUndefined();
    expect(auditPayload.category).toBe('study_assigned');
    expect(auditPayload.delivered).toBe(1);
    expect(auditPayload.reaped).toBe(1);
  });

  it('counts non-410 errors as failed without revoking the subscription', async () => {
    queueRows([[{ id: 'sub-x', endpoint: 'https://e', p256dh: 'p', auth: 'a' }]]);
    (webPush.sendNotification as jest.Mock).mockRejectedValue(
      Object.assign(new Error('boom'), { statusCode: 502 }),
    );
    const mod = await buildModule({
      VAPID_PUBLIC_KEY: 'B'.repeat(80),
      VAPID_PRIVATE_KEY: 'p'.repeat(40),
    });
    const service = mod.get(PushService);
    const result = await service.sendToUser('user-x', { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 0, reaped: 0, failed: 1 });
    expect((db as any).__updates.some((u: any) => u.revokedAt !== undefined)).toBe(false);
  });

  describe('sendToProfessional (Sprint 30 helper)', () => {
    it('resolves professional → user and delegates to sendToUser', async () => {
      // First .where().limit(1) → app_user row; second .where() (no
      // .limit) → list of push subs.
      queueRows([
        [{ id: 'user-77' }], // app_user lookup
        [{ id: 'sub-a', endpoint: 'https://ok', p256dh: 'p', auth: 'a' }], // subs
      ]);
      (webPush.sendNotification as jest.Mock).mockResolvedValue({});

      const mod = await buildModule({
        VAPID_PUBLIC_KEY: 'B'.repeat(80),
        VAPID_PRIVATE_KEY: 'p'.repeat(40),
      });
      const service = mod.get(PushService);
      const result = await service.sendToProfessional('prof-1', {
        title: 'Estudio asignado',
        body: 'CT cráneo',
        category: 'study_assigned',
      });
      expect(result).toEqual({ delivered: 1, reaped: 0, failed: 0 });
    });

    it('returns a no-op result when the professional has no app_user row', async () => {
      queueRows([[]]); // app_user lookup miss
      const mod = await buildModule({
        VAPID_PUBLIC_KEY: 'B'.repeat(80),
        VAPID_PRIVATE_KEY: 'p'.repeat(40),
      });
      const service = mod.get(PushService);
      const result = await service.sendToProfessional('prof-ghost', {
        title: 't',
        body: 'b',
      });
      expect(result).toEqual({ delivered: 0, reaped: 0, failed: 0 });
      expect(webPush.sendNotification).not.toHaveBeenCalled();
    });
  });
});
