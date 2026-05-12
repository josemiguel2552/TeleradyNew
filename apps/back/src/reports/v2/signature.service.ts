import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DBOrTx, db as defaultDb } from '../../database/drizzle';
import { professionalInTelerady } from '../../database/schema';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { StorageService } from '../../integrations/storage/storage.service';
import type { ReportRow } from './report-v2.repository';
import type { SignReportDto } from './dto/sign-report.dto';
import { TsaService } from './tsa.service';

export interface SignatureResult {
  signatureData: Record<string, unknown>;
}

@Injectable()
export class SignatureService {
  constructor(
    private readonly enc: ColumnEncryptionService,
    private readonly storage: StorageService,
    private readonly tsa: TsaService,
  ) {}

  async sign(
    hospitalPolicy: string,
    report: ReportRow,
    dto: SignReportDto,
    db: DBOrTx = defaultDb,
  ): Promise<SignatureResult> {
    if (dto.policy !== hospitalPolicy) {
      throw new BadRequestException(
        `Signature policy ${dto.policy} not allowed by hospital (expected ${hospitalPolicy})`,
      );
    }

    const professional = await this.fetchProfessional(report.professionalId, db);
    const displayedName =
      dto.displayedName ?? `${professional?.name ?? ''} ${professional?.lastName ?? ''}`.trim();
    const collegiate = dto.collegiate ?? professional?.professionalLicense ?? '';

    if (!displayedName || !collegiate) {
      throw new BadRequestException(
        'Cannot sign without a displayed name and a collegiate number',
      );
    }

    if (dto.policy === 'name_collegiate') {
      return {
        signatureData: {
          policy: 'name_collegiate',
          displayedName,
          collegiate,
          signedAt: new Date().toISOString(),
          contentsDigest: this.contentsDigest(report.contents),
        },
      };
    }

    if (!dto.drawn) {
      throw new BadRequestException('drawn payload is required for drawn_hash_tsa');
    }

    const png = Buffer.from(dto.drawn.drawingBase64, 'base64');
    const aad = `signature:${report.id}`;
    const stored = await this.storage.put({
      key: `signatures/${report.id}/v${report.version}.png`,
      body: png,
      contentType: 'image/png',
      bucket: 'reports',
      metadata: { reportId: report.id, professionalId: report.professionalId },
    });
    void aad; // signature image is stored as-is (it is already a derivative of plaintext input)

    const bundle = Buffer.concat([
      Buffer.from(this.contentsDigest(report.contents), 'utf8'),
      png,
      Buffer.from(displayedName, 'utf8'),
      Buffer.from(collegiate, 'utf8'),
    ]);
    const stamp = await this.tsa.stamp(bundle);

    return {
      signatureData: {
        policy: 'drawn_hash_tsa',
        displayedName,
        collegiate,
        drawingBucket: stored.bucket,
        drawingKey: stored.key,
        contentsDigest: this.contentsDigest(report.contents),
        tsa: stamp,
        signedAt: stamp.ts,
      },
    };
  }

  private async fetchProfessional(id: string, db: DBOrTx) {
    const rows = await db
      .select({
        name: professionalInTelerady.name,
        lastName: professionalInTelerady.lastName,
        professionalLicense: professionalInTelerady.professionalLicense,
      })
      .from(professionalInTelerady)
      .where(eq(professionalInTelerady.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  private contentsDigest(contents: unknown): string {
    return createHash('sha256').update(JSON.stringify(contents ?? {})).digest('hex');
  }
}
