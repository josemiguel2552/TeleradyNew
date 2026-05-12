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
