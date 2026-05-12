import { z } from 'zod';

const hexBytes = (bytes: number) =>
  z
    .string()
    .regex(/^[0-9a-fA-F]+$/, 'must be hex')
    .length(bytes * 2, `must be ${bytes} bytes (${bytes * 2} hex chars)`);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  REDIS_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_ISSUER: z.string().default('telerady'),
  JWT_AUDIENCE: z.string().default('telerady-api'),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:4200')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  ENCRYPTION_MASTER_KEY: hexBytes(32),
  PSEUDONYM_PEPPER: hexBytes(32),
  AUDIT_HASH_CHAIN_SEED: hexBytes(32).optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('eu-south-2'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_REPORTS: z.string().default('telerady-reports'),
  S3_BUCKET_DOCUMENTS: z.string().default('telerady-documents'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  ORTHANC_URL: z.string().url().optional(),
  ORTHANC_USER: z.string().optional(),
  ORTHANC_PASSWORD: z.string().optional(),
  ORTHANC_DICOMWEB_PATH: z.string().default('/dicom-web'),

  GOOGLE_CLIENT_EMAIL: z.string().email().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  FOLDER_TELERADY_DOC_ID: z.string().optional(),

  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  DEFAULT_RETENTION_DAYS: z.coerce.number().int().positive().default(3650),

  SWAGGER_USER: z.string().optional(),
  SWAGGER_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((err) => `  - ${err.path.join('.') || '(root)'}: ${err.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${errors}`);
  }

  if (parsed.data.NODE_ENV === 'production') {
    const required = (key: keyof Env) => {
      if (parsed.data[key] === undefined || parsed.data[key] === '') {
        throw new Error(`Environment variable ${key} is required in production.`);
      }
    };
    required('REDIS_URL');
    required('S3_ENDPOINT');
    required('S3_ACCESS_KEY');
    required('S3_SECRET_KEY');
    if (!parsed.data.COOKIE_SECURE) {
      throw new Error('COOKIE_SECURE must be true in production.');
    }
  }

  return parsed.data;
}
