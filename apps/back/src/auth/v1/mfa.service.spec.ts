import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';

jest.mock('../../database/drizzle', () => {
  const limitQueue: unknown[] = [];
  const updates: any[] = [];
  const builder = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(() => Promise.resolve(limitQueue.shift() ?? [])),
  };
  const updateBuilder = {
    set: jest.fn((v: unknown) => {
      updates.push(v);
      return { where: jest.fn().mockResolvedValue(undefined) };
    }),
  };
  return {
    db: {
      select: jest.fn(() => builder),
      update: jest.fn(() => updateBuilder),
      __limitQueue: limitQueue,
      __updates: updates,
    },
  };
});

import { db } from '../../database/drizzle';
import { MfaService } from './mfa.service';

function queueRows(rows: unknown[][]) {
  const queue = (db as any).__limitQueue as unknown[];
  queue.length = 0;
  queue.push(...rows);
}

function makeService(): MfaService {
  const config = {
    getOrThrow: () => 'telerady',
  } as unknown as ConfigService;
  const enc = {
    encrypt: jest.fn((plain: string) => `gcm:${plain}`),
    decrypt: jest.fn((packed: string) => packed.replace(/^gcm:/, '')),
  } as unknown as ColumnEncryptionService;
  return new MfaService(enc, config);
}

describe('MfaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db as any).__updates.length = 0;
  });

  it('setup generates a secret, stores it encrypted and leaves MFA disabled until confirm', async () => {
    const svc = makeService();
    const result = await svc.setup('user-1', 'rad@x.es');
    expect(result.secret).toMatch(/^[A-Z2-7]+$/); // base32
    expect(result.otpauthUrl).toContain('otpauth://totp/');
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect((db as any).__updates[0].mfaEnabled).toBe(false);
    expect((db as any).__updates[0].mfaSecretEnc).toMatch(/^gcm:/);
  });

  it('confirm rejects when no pending setup exists', async () => {
    queueRows([[{ mfaSecretEnc: null }]]);
    await expect(makeService().confirm('user-1', '123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('confirm rejects an invalid TOTP and accepts a valid one', async () => {
    const svc = makeService();
    const secret = authenticator.generateSecret();
    // Re-queue the same secret row for each call.
    queueRows([[{ mfaSecretEnc: `gcm:${secret}` }]]);
    await expect(svc.confirm('user-1', '000000')).rejects.toBeInstanceOf(BadRequestException);

    queueRows([[{ mfaSecretEnc: `gcm:${secret}` }]]);
    const valid = authenticator.generate(secret);
    await svc.confirm('user-1', valid);
    // Found at least one update flipping mfaEnabled true.
    expect((db as any).__updates.some((u: any) => u.mfaEnabled === true)).toBe(true);
  });

  it('verifyForLogin throws when token is missing', async () => {
    await expect(makeService().verifyForLogin('u', undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('verifyForLogin throws when the user has no MFA configured', async () => {
    queueRows([[{ mfaSecretEnc: null }]]);
    await expect(makeService().verifyForLogin('u', '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('verifyForLogin throws on an invalid token and resolves on a valid one', async () => {
    const svc = makeService();
    const secret = authenticator.generateSecret();
    queueRows([[{ mfaSecretEnc: `gcm:${secret}` }]]);
    await expect(svc.verifyForLogin('u', '000000')).rejects.toBeInstanceOf(UnauthorizedException);

    queueRows([[{ mfaSecretEnc: `gcm:${secret}` }]]);
    await expect(svc.verifyForLogin('u', authenticator.generate(secret))).resolves.toBeUndefined();
  });

  it('disable clears the encrypted secret', async () => {
    const svc = makeService();
    await svc.disable('user-1');
    const row = (db as any).__updates[0];
    expect(row.mfaEnabled).toBe(false);
    expect(row.mfaSecretEnc).toBeNull();
  });
});
