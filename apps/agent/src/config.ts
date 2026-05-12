import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  TELERADY_API_URL: z.string().url(),
  TELERADY_API_TOKEN: z.string().min(20).optional(),
  TELERADY_CLIENT_CERT: z.string().optional(),
  TELERADY_CLIENT_KEY: z.string().optional(),
  TELERADY_CA: z.string().optional(),
  WATCH_FOLDER: z.string().min(1),
  ARCHIVE_FOLDER: z.string().min(1),
  QUARANTINE_FOLDER: z.string().min(1),
  STABILITY_THRESHOLD_MS: z.coerce.number().int().positive().default(5000),
  MAX_CONCURRENT_UPLOADS: z.coerce.number().int().positive().max(16).default(2),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type AgentConfig = z.infer<typeof schema>;

export function loadConfig(): AgentConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((err) => `  - ${err.path.join('.') || '(root)'}: ${err.message}`)
      .join('\n');
    throw new Error(`Invalid agent configuration:\n${errors}`);
  }
  const value = parsed.data;
  if (!value.TELERADY_API_TOKEN && !(value.TELERADY_CLIENT_CERT && value.TELERADY_CLIENT_KEY)) {
    throw new Error(
      'Authentication required: set TELERADY_API_TOKEN or both TELERADY_CLIENT_CERT and TELERADY_CLIENT_KEY.',
    );
  }
  return value;
}
