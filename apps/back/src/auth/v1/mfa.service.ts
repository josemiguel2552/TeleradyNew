import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import { appUserInTelerady } from '../../database/schema';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';

export interface MfaSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

@Injectable()
export class MfaService {
  private readonly issuer: string;

  constructor(
    private readonly enc: ColumnEncryptionService,
    config: ConfigService,
  ) {
    this.issuer = config.getOrThrow<string>('JWT_ISSUER');
    authenticator.options = { window: 1, step: 30, digits: 6 };
  }

  async setup(userId: string, email: string): Promise<MfaSetupResult> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, this.issuer, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    // Store the secret encrypted, but do not enable MFA yet — the user must
    // confirm by entering a valid TOTP code first.
    const encrypted = this.enc.encrypt(secret, `mfa:${userId}`);
    await db
      .update(appUserInTelerady)
      .set({ mfaSecretEnc: encrypted, mfaEnabled: false, updatedAt: sql`now()` })
      .where(eq(appUserInTelerady.id, userId));

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async confirm(userId: string, token: string): Promise<void> {
    const secret = await this.getDecryptedSecret(userId);
    if (!secret) throw new BadRequestException('No pending MFA setup');
    if (!authenticator.verify({ token, secret })) {
      throw new BadRequestException('Invalid TOTP code');
    }
    await db
      .update(appUserInTelerady)
      .set({ mfaEnabled: true, updatedAt: sql`now()` })
      .where(eq(appUserInTelerady.id, userId));
  }

  async verifyForLogin(userId: string, token: string | undefined): Promise<void> {
    if (!token) throw new UnauthorizedException('TOTP code required');
    const secret = await this.getDecryptedSecret(userId);
    if (!secret) throw new UnauthorizedException('MFA is not configured');
    if (!authenticator.verify({ token, secret })) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
  }

  async disable(userId: string): Promise<void> {
    await db
      .update(appUserInTelerady)
      .set({ mfaEnabled: false, mfaSecretEnc: null, updatedAt: sql`now()` })
      .where(eq(appUserInTelerady.id, userId));
  }

  private async getDecryptedSecret(userId: string): Promise<string | null> {
    const rows = await db
      .select({ mfaSecretEnc: appUserInTelerady.mfaSecretEnc })
      .from(appUserInTelerady)
      .where(eq(appUserInTelerady.id, userId))
      .limit(1);
    if (!rows[0]?.mfaSecretEnc) return null;
    return this.enc.decrypt(rows[0].mfaSecretEnc, `mfa:${userId}`);
  }
}
