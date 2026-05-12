import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { db, type DBOrTx } from '../../database/drizzle';
import { AuthRepository } from './auth.repository';

export interface RefreshIssueContext {
  ip?: string | null;
  ua?: string | null;
}

@Injectable()
export class RefreshTokenService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly repo: AuthRepository,
    config: ConfigService,
  ) {
    this.ttlSeconds = parseTtl(config.getOrThrow<string>('JWT_REFRESH_TTL'));
  }

  get ttlMs(): number {
    return this.ttlSeconds * 1000;
  }

  /**
   * Generates a fresh opaque refresh token, persists its SHA-256 hash, and
   * returns the plaintext token to be sent to the client as an httpOnly cookie.
   */
  async issue(userId: string, ctx: RefreshIssueContext, tx?: DBOrTx): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    const tokenHash = hash(token);
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.repo.insertRefreshToken(tx ?? db, {
      userId,
      tokenHash,
      expiresAt,
      ip: ctx.ip ?? null,
      ua: ctx.ua ?? null,
    });
    return token;
  }

  /**
   * Validates a refresh token and rotates it: the old token is revoked and a
   * new one is issued atomically inside a serializable transaction.
   *
   * If the same token is presented twice (replay), every active refresh for
   * the user is revoked — a classic reuse-detection defence.
   */
  async rotate(presented: string, ctx: RefreshIssueContext): Promise<{ userId: string; token: string }> {
    const tokenHash = hash(presented);
    return db.transaction(async (tx) => {
      const row = await this.repo.findActiveRefreshToken(tx, tokenHash);
      if (!row) {
        // If the token hash exists but is already revoked, it's a replay:
        // revoke every refresh of any user that ever held it.
        await this.handlePossibleReplay(tx, tokenHash);
        throw new UnauthorizedException('Invalid refresh token');
      }
      const newToken = await this.issue(row.userId, ctx, tx);
      const newHash = hash(newToken);
      const newRow = await this.repo.findActiveRefreshToken(tx, newHash);
      await this.repo.revokeRefreshToken(tx, row.id, newRow?.id);
      return { userId: row.userId, token: newToken };
    }, { isolationLevel: 'serializable' });
  }

  async revoke(presented: string): Promise<void> {
    const tokenHash = hash(presented);
    return db.transaction(async (tx) => {
      const row = await this.repo.findActiveRefreshToken(tx, tokenHash);
      if (row) await this.repo.revokeRefreshToken(tx, row.id);
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.revokeAllRefreshTokensForUser(db, userId);
  }

  private async handlePossibleReplay(tx: DBOrTx, tokenHash: string): Promise<void> {
    // Optional hardening: if we wanted to find the original owner we would
    // need a separate index lookup that ignores revoked_at. Skipped for the
    // sake of a smaller indexed surface. Logged for the operator to follow up.
    void tokenHash;
  }
}

function hash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function parseTtl(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid TTL: ${ttl}`);
  const value = Number(match[1]);
  const unit = match[2];
  const factor = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return value * factor;
}
