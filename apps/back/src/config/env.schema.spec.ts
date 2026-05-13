import { validateEnv } from './env.schema';

const validBase: Record<string, string> = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  ENCRYPTION_MASTER_KEY: '11'.repeat(32),
  PSEUDONYM_PEPPER: '22'.repeat(32),
};

describe('validateEnv', () => {
  it('parses a minimal valid configuration with defaults', () => {
    const env = validateEnv(validBase);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:4200']);
  });

  it('coerces PORT from a string', () => {
    const env = validateEnv({ ...validBase, PORT: '4000' });
    expect(env.PORT).toBe(4000);
  });

  it('splits CORS_ORIGINS by comma and trims', () => {
    const env = validateEnv({
      ...validBase,
      CORS_ORIGINS: ' https://a.test , https://b.test ',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://a.test', 'https://b.test']);
  });

  it('rejects an invalid DATABASE_URL', () => {
    expect(() => validateEnv({ ...validBase, DATABASE_URL: 'not-a-url' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...validBase, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects a non-hex encryption key', () => {
    expect(() =>
      validateEnv({ ...validBase, ENCRYPTION_MASTER_KEY: 'zzz' }),
    ).toThrow(/ENCRYPTION_MASTER_KEY/);
  });

  it('requires production-only fields when NODE_ENV=production', () => {
    expect(() =>
      validateEnv({ ...validBase, NODE_ENV: 'production', COOKIE_SECURE: 'true' }),
    ).toThrow(/REDIS_URL/);
  });

  // ---- Sprint 21 onwards: AI provider envs ---------------------------------
  it('AI_DRAFT_PROVIDER defaults to radiogenai when unset', () => {
    expect(validateEnv(validBase).AI_DRAFT_PROVIDER).toBe('radiogenai');
  });

  it('rejects an unknown AI_DRAFT_PROVIDER value', () => {
    expect(() =>
      validateEnv({ ...validBase, AI_DRAFT_PROVIDER: 'gpt-magic' }),
    ).toThrow(/AI_DRAFT_PROVIDER/);
  });

  it('rejects a non-URL OLLAMA_URL', () => {
    expect(() =>
      validateEnv({ ...validBase, AI_DRAFT_PROVIDER: 'ollama', OLLAMA_URL: 'not-a-url' }),
    ).toThrow(/OLLAMA_URL/);
  });

  // ---- Sprint 27 / 29: server-to-server secrets ----------------------------
  it('rejects an INTEGRATION_API_KEY shorter than 32 chars', () => {
    expect(() =>
      validateEnv({ ...validBase, INTEGRATION_API_KEY: 'short' }),
    ).toThrow(/INTEGRATION_API_KEY/);
  });

  it('accepts a 64-char hex INTEGRATION_API_KEY', () => {
    const env = validateEnv({ ...validBase, INTEGRATION_API_KEY: 'a'.repeat(64) });
    expect(env.INTEGRATION_API_KEY).toHaveLength(64);
  });

  it('rejects a malformed VAPID_SUBJECT (must be mailto: or https:)', () => {
    expect(() =>
      validateEnv({
        ...validBase,
        VAPID_PUBLIC_KEY: 'B'.repeat(80),
        VAPID_PRIVATE_KEY: 'p'.repeat(40),
        VAPID_SUBJECT: 'ops@telerady.es', // missing mailto:
      }),
    ).toThrow(/VAPID_SUBJECT/);
  });

  it('VAPID keys are optional (push self-disables when missing)', () => {
    // Just asserting the schema does not require them; the runtime
    // surfaces the disabled state via PushService.configured.
    expect(() => validateEnv(validBase)).not.toThrow();
  });

  it('requires COOKIE_SECURE=true in production', () => {
    expect(() =>
      validateEnv({
        ...validBase,
        NODE_ENV: 'production',
        REDIS_URL: 'redis://r:6379',
        S3_ENDPOINT: 'https://s3.example.com',
        S3_ACCESS_KEY: 'x',
        S3_SECRET_KEY: 'y',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow(/COOKIE_SECURE/);
  });
});
