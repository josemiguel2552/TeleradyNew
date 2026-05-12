import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { DBOrTx } from '../../database/drizzle';
import {
  appUserInTelerady,
  hospitalInTelerady,
  hospitalMembershipInTelerady,
  refreshTokenInTelerady,
  userRoleAssignmentInTelerady,
  type HospitalSignaturePolicy,
} from '../../database/schema';

export interface NewHospitalRow {
  name: string;
  taxId?: string | null;
  signaturePolicy: HospitalSignaturePolicy;
  retentionDays: number;
}

export interface NewUserRow {
  email: string;
  passwordHash: string;
  professionalId?: string | null;
}

@Injectable()
export class AuthRepository {
  async createHospital(db: DBOrTx, data: NewHospitalRow): Promise<string> {
    const [row] = await db
      .insert(hospitalInTelerady)
      .values({
        name: data.name,
        taxId: data.taxId ?? null,
        signaturePolicy: data.signaturePolicy,
        retentionDays: data.retentionDays,
      })
      .returning({ id: hospitalInTelerady.id });
    return row.id;
  }

  async createUser(db: DBOrTx, data: NewUserRow): Promise<string> {
    const [row] = await db
      .insert(appUserInTelerady)
      .values({
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        professionalId: data.professionalId ?? null,
      })
      .returning({ id: appUserInTelerady.id });
    return row.id;
  }

  async assignRole(db: DBOrTx, userId: string, role: string): Promise<void> {
    await db
      .insert(userRoleAssignmentInTelerady)
      .values({ userId, role })
      .onConflictDoNothing();
  }

  async addHospitalMembership(
    db: DBOrTx,
    userId: string,
    hospitalId: string,
    isAdmin: boolean,
  ): Promise<void> {
    await db
      .insert(hospitalMembershipInTelerady)
      .values({ userId, hospitalId, isAdmin })
      .onConflictDoNothing();
  }

  async findUserByEmail(db: DBOrTx, email: string) {
    const rows = await db
      .select()
      .from(appUserInTelerady)
      .where(sql`lower(${appUserInTelerady.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return rows[0] ?? null;
  }

  async findUserById(db: DBOrTx, id: string) {
    const rows = await db
      .select()
      .from(appUserInTelerady)
      .where(eq(appUserInTelerady.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async getRolesForUser(db: DBOrTx, userId: string): Promise<string[]> {
    const rows = await db
      .select({ role: userRoleAssignmentInTelerady.role })
      .from(userRoleAssignmentInTelerady)
      .where(eq(userRoleAssignmentInTelerady.userId, userId));
    return rows.map((r) => r.role);
  }

  async getHospitalIdsForUser(db: DBOrTx, userId: string): Promise<string[]> {
    const rows = await db
      .select({ hospitalId: hospitalMembershipInTelerady.hospitalId })
      .from(hospitalMembershipInTelerady)
      .where(eq(hospitalMembershipInTelerady.userId, userId));
    return rows.map((r) => r.hospitalId);
  }

  async bumpFailedAttempts(
    db: DBOrTx,
    userId: string,
    lockUntil: Date | null,
  ): Promise<number> {
    const [row] = await db
      .update(appUserInTelerady)
      .set({
        failedAttempts: sql`${appUserInTelerady.failedAttempts} + 1`,
        lockedUntil: lockUntil ? lockUntil.toISOString() : null,
        updatedAt: sql`now()`,
      })
      .where(eq(appUserInTelerady.id, userId))
      .returning({ failedAttempts: appUserInTelerady.failedAttempts });
    return row?.failedAttempts ?? 0;
  }

  async resetFailedAttempts(db: DBOrTx, userId: string): Promise<void> {
    await db
      .update(appUserInTelerady)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(appUserInTelerady.id, userId));
  }

  async insertRefreshToken(
    db: DBOrTx,
    row: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      ip?: string | null;
      ua?: string | null;
    },
  ): Promise<string> {
    const [{ id }] = await db
      .insert(refreshTokenInTelerady)
      .values({
        userId: row.userId,
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt.toISOString(),
        ip: row.ip ?? null,
        ua: row.ua ?? null,
      })
      .returning({ id: refreshTokenInTelerady.id });
    return id;
  }

  async findActiveRefreshToken(db: DBOrTx, tokenHash: string) {
    const rows = await db
      .select()
      .from(refreshTokenInTelerady)
      .where(
        and(
          eq(refreshTokenInTelerady.tokenHash, tokenHash),
          isNull(refreshTokenInTelerady.revokedAt),
          gt(refreshTokenInTelerady.expiresAt, sql`now()`),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async revokeRefreshToken(db: DBOrTx, id: string, replacedById?: string): Promise<void> {
    await db
      .update(refreshTokenInTelerady)
      .set({
        revokedAt: sql`now()`,
        replacedById: replacedById ?? null,
      })
      .where(eq(refreshTokenInTelerady.id, id));
  }

  async revokeAllRefreshTokensForUser(db: DBOrTx, userId: string): Promise<void> {
    await db
      .update(refreshTokenInTelerady)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(refreshTokenInTelerady.userId, userId),
          isNull(refreshTokenInTelerady.revokedAt),
        ),
      );
  }
}
