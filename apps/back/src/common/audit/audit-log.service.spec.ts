import { ConfigService } from '@nestjs/config';
import { AuditLogService } from './audit-log.service';
import { HashChainService } from '../crypto/hash-chain.service';

jest.mock('../../database/drizzle', () => ({ db: {} }));

describe('AuditLogService.append (tx mode)', () => {
  const chain = new HashChainService();
  const seed = '00'.repeat(32);
  const config = { get: () => seed } as unknown as ConfigService;

  function mockTx(lastHash: string | null) {
    let inserted: any;
    const tx = {
      select: () => ({
        from: () => ({
          orderBy: () => ({
            limit: () => ({
              for: async () => (lastHash ? [{ hash: lastHash }] : []),
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (v: any) => ({
          returning: async () => {
            inserted = v;
            return [{ id: 'new-id' }];
          },
        }),
      }),
    } as any;
    return { tx, getInserted: () => inserted };
  }

  it('uses the chain seed for the first record', async () => {
    const svc = new AuditLogService(chain, config);
    const { tx, getInserted } = mockTx(null);

    const entry = {
      action: 'login',
      targetKind: 'User',
      targetId: 'u-1',
      payload: { ok: true },
    };
    const { hash } = await svc.append(entry, tx);

    const inserted = getInserted();
    expect(inserted.prevHash).toBe(seed);
    expect(inserted.hash).toBe(hash);
    expect(chain.verify(seed, { ...stripChainFields(inserted) }, hash)).toBe(true);
  });

  it('chains onto the most recent hash', async () => {
    const svc = new AuditLogService(chain, config);
    const previous = 'aa'.repeat(32);
    const { tx, getInserted } = mockTx(previous);

    await svc.append(
      {
        action: 'sign_report',
        targetKind: 'Report',
        targetId: 'r-1',
        payload: { studyId: 's-1' },
        actorId: 'u-1',
      },
      tx,
    );

    expect(getInserted().prevHash).toBe(previous);
  });
});

function stripChainFields(obj: any) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { prevHash, hash, ...rest } = obj;
  return rest;
}
