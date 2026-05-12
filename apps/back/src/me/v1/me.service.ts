import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import {
  appUserInTelerady,
  freelancerDataInTelerady,
  hospitalMembershipInTelerady,
  professionalInTelerady,
  professionalSubspecialtyInTelerady,
  refreshTokenInTelerady,
  userRoleAssignmentInTelerady,
} from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';

export interface DataExport {
  exportedAt: string;
  user: Record<string, unknown>;
  roles: string[];
  hospitals: string[];
  professional: Record<string, unknown> | null;
  freelancerData: Record<string, unknown> | null;
  subspecialties: number[];
}

@Injectable()
export class MeService {
  constructor(
    private readonly enc: ColumnEncryptionService,
    private readonly audit: AuditLogService,
  ) {}

  async export(user: AuthenticatedUser): Promise<DataExport> {
    const userRows = await db
      .select({
        id: appUserInTelerady.id,
        email: appUserInTelerady.email,
        mfaEnabled: appUserInTelerady.mfaEnabled,
        professionalId: appUserInTelerady.professionalId,
        lastLoginAt: appUserInTelerady.lastLoginAt,
        createdAt: appUserInTelerady.createdAt,
      })
      .from(appUserInTelerady)
      .where(eq(appUserInTelerady.id, user.id))
      .limit(1);

    const roles = await db
      .select({ role: userRoleAssignmentInTelerady.role })
      .from(userRoleAssignmentInTelerady)
      .where(eq(userRoleAssignmentInTelerady.userId, user.id));

    const hospitals = await db
      .select({ hospitalId: hospitalMembershipInTelerady.hospitalId })
      .from(hospitalMembershipInTelerady)
      .where(eq(hospitalMembershipInTelerady.userId, user.id));

    let professional: Record<string, unknown> | null = null;
    let freelancer: Record<string, unknown> | null = null;
    let subspecialties: number[] = [];

    if (user.professionalId) {
      const profRows = await db
        .select()
        .from(professionalInTelerady)
        .where(eq(professionalInTelerady.id, user.professionalId))
        .limit(1);
      professional = profRows[0] ? { ...profRows[0] } : null;

      const freelancerRows = await db
        .select()
        .from(freelancerDataInTelerady)
        .where(eq(freelancerDataInTelerady.professionalId, user.professionalId))
        .limit(1);
      if (freelancerRows[0]) {
        const row = freelancerRows[0];
        freelancer = {
          ...row,
          bankAccount:
            this.enc.decryptIfPresent(row.bankAccountEnc, `freelancer:${row.professionalId}`) ??
            row.bankAccount,
        };
      }
      const subRows = await db
        .select({ id: professionalSubspecialtyInTelerady.subspecialtyId })
        .from(professionalSubspecialtyInTelerady)
        .where(eq(professionalSubspecialtyInTelerady.professionalId, user.professionalId));
      subspecialties = subRows.map((r) => r.id);
    }

    await this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      action: 'rgpd.data_export',
      targetKind: 'User',
      targetId: user.id,
      payload: {},
    });

    return {
      exportedAt: new Date().toISOString(),
      user: userRows[0] ?? { id: user.id, email: user.email },
      roles: roles.map((r) => r.role),
      hospitals: hospitals.map((h) => h.hospitalId),
      professional,
      freelancerData: freelancer,
      subspecialties,
    };
  }

  async setProcessingRestriction(
    user: AuthenticatedUser,
    restricted: boolean,
  ): Promise<{ restricted: boolean }> {
    await db
      .update(appUserInTelerady)
      .set({ processingRestricted: restricted, updatedAt: sql`now()` })
      .where(eq(appUserInTelerady.id, user.id));
    await this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      action: 'rgpd.processing_restriction',
      targetKind: 'User',
      targetId: user.id,
      payload: { restricted },
    });
    return { restricted };
  }

  /**
   * Logical-delete of the user. Right-to-erasure (art. 17 RGPD): we tombstone
   * the account (anonymise email, blank the password hash, revoke MFA),
   * revoke every refresh token, and keep the professional row tied to a
   * pseudonym so finalized reports remain auditable (legal obligation under
   * art. 17.3.b RGPD). The professional record stays alive but with PII
   * stripped to a sha-256 derived identifier.
   */
  async deleteAccount(user: AuthenticatedUser): Promise<{ deletedAt: string }> {
    const deletedAt = new Date().toISOString();
    const tombstone = `deleted-${user.id}@telerady.local`;

    await db.transaction(async (tx) => {
      await tx
        .update(appUserInTelerady)
        .set({
          email: tombstone,
          passwordHash: '',
          mfaEnabled: false,
          mfaSecretEnc: null,
          lockedUntil: null,
          updatedAt: sql`now()`,
        })
        .where(eq(appUserInTelerady.id, user.id));
      await tx
        .update(refreshTokenInTelerady)
        .set({ revokedAt: sql`now()` })
        .where(eq(refreshTokenInTelerady.userId, user.id));
      if (user.professionalId) {
        await tx
          .update(professionalInTelerady)
          .set({
            name: 'redacted',
            lastName: 'redacted',
            phone: null,
            email: tombstone,
            cityResidence: 'redacted',
          })
          .where(eq(professionalInTelerady.id, user.professionalId));
        await tx
          .update(freelancerDataInTelerady)
          .set({ bankAccount: null, bankAccountEnc: null })
          .where(eq(freelancerDataInTelerady.professionalId, user.professionalId));
      }
      await this.audit.append(
        {
          actorId: user.id,
          actorRole: user.roles[0] ?? null,
          action: 'rgpd.account_deleted',
          targetKind: 'User',
          targetId: user.id,
          payload: { tombstone, professionalId: user.professionalId ?? null },
        },
        tx,
      );
    });

    return { deletedAt };
  }
}
