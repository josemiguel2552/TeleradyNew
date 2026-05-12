import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  ServerSideEncryption,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

export type StorageBucket = 'reports' | 'documents';

export interface PutObjectInput {
  key: string;
  body: Buffer | Readable | Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
  bucket?: StorageBucket;
}

/**
 * S3-compatible storage service backed by MinIO in dev and a sovereign
 * Spanish S3 provider in production. SSE-S3 server-side encryption is
 * requested on every upload; if the backend doesn't honour the header it
 * doesn't fail the request but the operator must verify the policy.
 *
 * Bucket selection: `'reports'` for signed PDFs and study artifacts,
 * `'documents'` for professional documents (DNI, colegiate certificates).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  private reportsBucket!: string;
  private documentsBucket!: string;
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY');
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'StorageService is not configured (S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY missing). Calls will throw.',
      );
      return;
    }
    this.client = new S3Client({
      endpoint,
      region: this.config.getOrThrow<string>('S3_REGION'),
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: this.config.getOrThrow<boolean>('S3_FORCE_PATH_STYLE'),
    });
    this.reportsBucket = this.config.getOrThrow<string>('S3_BUCKET_REPORTS');
    this.documentsBucket = this.config.getOrThrow<string>('S3_BUCKET_DOCUMENTS');
    this.configured = true;
  }

  async ensureReady(): Promise<void> {
    if (!this.configured) throw new Error('StorageService is not configured');
    await this.client.send(new HeadBucketCommand({ Bucket: this.reportsBucket }));
    await this.client.send(new HeadBucketCommand({ Bucket: this.documentsBucket }));
  }

  async put(input: PutObjectInput): Promise<{ bucket: string; key: string }> {
    this.assertConfigured();
    const bucket = this.bucketFor(input.bucket ?? 'documents');
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
        ServerSideEncryption: ServerSideEncryption.AES256,
      }),
    );
    return { bucket, key: input.key };
  }

  async getBuffer(key: string, bucket: StorageBucket = 'documents'): Promise<Buffer> {
    this.assertConfigured();
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketFor(bucket), Key: key }),
    );
    const body = out.Body as Readable | undefined;
    if (!body) return Buffer.alloc(0);
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  /**
   * Returns a short-lived signed URL the SPA can hand to the browser. The
   * TTL is intentionally low (5 minutes) — long enough for the user to
   * download, short enough that a leaked URL is uninteresting.
   */
  async signedGetUrl(
    key: string,
    bucket: StorageBucket = 'documents',
    ttlSeconds: number = 300,
  ): Promise<string> {
    this.assertConfigured();
    const command = new GetObjectCommand({ Bucket: this.bucketFor(bucket), Key: key });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  async delete(key: string, bucket: StorageBucket = 'documents'): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucketFor(bucket), Key: key }),
    );
  }

  private bucketFor(bucket: StorageBucket): string {
    return bucket === 'reports' ? this.reportsBucket : this.documentsBucket;
  }

  private assertConfigured(): void {
    if (!this.configured) throw new Error('StorageService is not configured');
  }
}
