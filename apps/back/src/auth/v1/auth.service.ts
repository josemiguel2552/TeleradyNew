import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  type LoggerService,
} from '@nestjs/common';
import { db } from '../../database/drizzle';
import { AuthRepository } from './auth.repository';
import { Argon2Service } from '../../common/crypto/argon2.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { JwtTokenService, type AccessTokenClaims } from './jwt-token.service';
import { RefreshTokenService } from './refresh-token.service';
import { Role } from '../roles';
import type { LoginDto } from './dto/login.dto';
import type { RegisterHospitalDto } from './dto/register-hospital.dto';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export interface AuthContext {
  ip?: string | null;
  ua?: string | null;
}

export interface IssuedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshMaxAgeMs: number;
  user: {
    id: string;
    email: string;
    roles: string[];
    hospitals: string[];
    professionalId: string | null;
    mfaEnabled: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly argon2: Argon2Service,
    private readonly jwt: JwtTokenService,
    private readonly refresh: RefreshTokenService,
    private readonly audit: AuditLogService,
  ) {}

  async registerHospital(
    dto: RegisterHospitalDto,
    actorId: string | null,
    ctx: AuthContext,
  ): Promise<{ hospitalId: string; adminUserId: string }> {
    const existing = await this.repo.findUserByEmail(db, dto.adminEmail);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    return db.transaction(async (tx) => {
      const hospitalId = await this.repo.createHospital(tx, {
        name: dto.name,
        taxId: dto.taxId ?? null,
        signaturePolicy: dto.signaturePolicy,
        retentionDays: dto.retentionDays,
      });
      const adminUserId = await this.repo.createUser(tx, {
        email: dto.adminEmail,
        passwordHash: await this.argon2.hash(dto.adminPassword),
      });
      await this.repo.assignRole(tx, adminUserId, Role.HospitalAdmin);
      await this.repo.addHospitalMembership(tx, adminUserId, hospitalId, true);

      await this.audit.append(
        {
          actorId,
          actorRole: actorId ? null : 'system',
          hospitalId,
          action: 'hospital.register',
          targetKind: 'Hospital',
          targetId: hospitalId,
          payload: {
            name: dto.name,
            signaturePolicy: dto.signaturePolicy,
            adminUserId,
          },
          requestIp: ctx.ip ?? null,
          requestUa: ctx.ua ?? null,
        },
        tx,
      );

      return { hospitalId, adminUserId };
    });
  }

  async login(dto: LoginDto, ctx: AuthContext, logger?: LoggerService): Promise<IssuedSession> {
    const user = await this.repo.findUserByEmail(db, dto.email);
    if (!user) {
      // Run argon2 anyway to keep the timing similar.
      await this.argon2.hash('decoy-password');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw new UnauthorizedException('Account temporarily locked');
    }

    const ok = await this.argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      const newCount = await this.repo.bumpFailedAttempts(
        db,
        user.id,
        null,
      );
      if (newCount >= MAX_FAILED_ATTEMPTS) {
        const lock = new Date(Date.now() + LOCK_MINUTES * 60_000);
        await this.repo.bumpFailedAttempts(db, user.id, lock);
        logger?.warn?.(`account locked: ${user.id}`);
      }
      await this.audit.append({
        actorId: user.id,
        action: 'auth.login.failed',
        targetKind: 'User',
        targetId: user.id,
        payload: { reason: 'invalid_password', failedAttempts: newCount },
        requestIp: ctx.ip ?? null,
        requestUa: ctx.ua ?? null,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.mfaEnabled && !dto.totp) {
      throw new UnauthorizedException('TOTP code required');
    }
    // MFA verification lands in a later commit when otplib is wired in.

    await this.repo.resetFailedAttempts(db, user.id);

    const roles = await this.repo.getRolesForUser(db, user.id);
    const hospitalIds = await this.repo.getHospitalIdsForUser(db, user.id);

    const claims: AccessTokenClaims = {
      sub: user.id,
      email: user.email,
      roles,
      hospitalIds,
      professionalId: user.professionalId ?? undefined,
      mfa: user.mfaEnabled,
    };
    const { token: accessToken, expiresIn } = this.jwt.signAccessToken(claims);
    const refreshToken = await this.refresh.issue(user.id, ctx);

    await this.audit.append({
      actorId: user.id,
      actorRole: roles[0] ?? null,
      hospitalId: hospitalIds[0] ?? null,
      action: 'auth.login.success',
      targetKind: 'User',
      targetId: user.id,
      payload: { roles, hospitals: hospitalIds.length },
      requestIp: ctx.ip ?? null,
      requestUa: ctx.ua ?? null,
    });

    return {
      accessToken,
      expiresIn,
      refreshToken,
      refreshMaxAgeMs: this.refresh.ttlMs,
      user: {
        id: user.id,
        email: user.email,
        roles,
        hospitals: hospitalIds,
        professionalId: user.professionalId ?? null,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  async refreshSession(presented: string, ctx: AuthContext): Promise<IssuedSession> {
    const { userId, token: newRefresh } = await this.refresh.rotate(presented, ctx);
    const user = await this.repo.findUserById(db, userId);
    if (!user) throw new UnauthorizedException('User not found');

    const roles = await this.repo.getRolesForUser(db, userId);
    const hospitalIds = await this.repo.getHospitalIdsForUser(db, userId);

    const { token: accessToken, expiresIn } = this.jwt.signAccessToken({
      sub: userId,
      email: user.email,
      roles,
      hospitalIds,
      professionalId: user.professionalId ?? undefined,
      mfa: user.mfaEnabled,
    });

    return {
      accessToken,
      expiresIn,
      refreshToken: newRefresh,
      refreshMaxAgeMs: this.refresh.ttlMs,
      user: {
        id: user.id,
        email: user.email,
        roles,
        hospitals: hospitalIds,
        professionalId: user.professionalId ?? null,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  async logout(presented: string | undefined, userId: string, ctx: AuthContext): Promise<void> {
    if (presented) await this.refresh.revoke(presented);
    await this.audit.append({
      actorId: userId,
      action: 'auth.logout',
      targetKind: 'User',
      targetId: userId,
      payload: {},
      requestIp: ctx.ip ?? null,
      requestUa: ctx.ua ?? null,
    });
  }
}
