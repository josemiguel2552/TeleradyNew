import { z } from 'zod';

const hexBytes = (bytes: number) =>
  z
    .string()
    .regex(/^[0-9a-fA-F]+$/, 'must be hex')
    .length(bytes * 2, `must be ${bytes} bytes (${bytes * 2} hex chars)`);

// dotenv / process.env never represent "missing" as undefined — an empty
// line in .env still lands as "". For optional fields we want the empty
// string to behave like absence so the inner validator (e.g. .url(),
// .min(N)) doesn't fire on a placeholder the operator left blank.
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

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
  REDIS_AUTH_PASSWORD: z.string().optional(),

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
  ORTHANC_MAX_UPLOAD_MB: z.coerce.number().int().positive().default(512),

  OHIF_URL: z.string().url().optional(),
  OHIF_VIEWER_PATH: z.string().default('/viewer'),

  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  DEFAULT_RETENTION_DAYS: z.coerce.number().int().positive().default(3650),

  RLS_ENABLED: z
    .enum(['true', 'false'])
    .default('false'),

  EMAIL_FROM: z.string().email().optional(),
  WEBHOOK_OUTGOING_SECRET: z.string().min(32).optional(),

  HL7_MLLP_ENABLED: z
    .enum(['true', 'false'])
    .default('false'),
  HL7_MLLP_PORT: z.coerce.number().int().positive().default(2575),

  RADIOGENAI_URL: optional(z.string().url()),
  RADIOGENAI_API_KEY: optional(z.string().min(20)),
  RADIOGENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  RADIOGENAI_DEFAULT_LANGUAGE: z.enum(['es', 'en']).default('es'),

  /**
   * Which AI draft provider the platform speaks to. Default is the
   * external RadiogenAI. `ollama` switches to a local runtime that
   * exposes /api/generate (no data leaves the perimeter — RGPD art.
   * 28 doesn't apply). Any other value disables drafting.
   */
  AI_DRAFT_PROVIDER: z.enum(['radiogenai', 'ollama', 'vllm', 'disabled']).default('radiogenai'),
  OLLAMA_URL: optional(z.string().url()),
  OLLAMA_MODEL: z.string().min(1).default('llama3.1:8b-instruct'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  VLLM_URL: optional(z.string().url()),
  VLLM_API_KEY: z.string().optional(),
  VLLM_MODEL: z.string().min(1).default('meta-llama/Meta-Llama-3.1-8B-Instruct'),
  VLLM_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),

  /**
   * Shared secret presented by inbound integrations (MPPS webhook from
   * Orthanc, HL7 ack scripts, …) in the `x-api-key` header. When unset
   * the integration endpoints respond 503 — fail closed.
   */
  INTEGRATION_API_KEY: optional(z.string().min(32)),

  /**
   * VAPID keys for Web Push (RFC 8292). Generate them once with
   * `npx web-push generate-vapid-keys`. When the public/private pair
   * is missing, the push endpoints respond 503 and subscriptions stay
   * dormant; this is the dev default.
   */
  VAPID_PUBLIC_KEY: optional(z.string().min(60)),
  VAPID_PRIVATE_KEY: optional(z.string().min(40)),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https?:)/).default('mailto:ops@telerady.es'),

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
