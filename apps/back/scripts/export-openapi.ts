/**
 * Exports the OpenAPI document the Nest app advertises in
 * `/api-docs/v1` to a JSON file under `docs/openapi.json`. Used by:
 *   - CI: drift-check (fail PR if the spec moved without bumping
 *     the snapshot).
 *   - Integration partners: feed it to `openapi-generator` to spin
 *     SDKs in their language of choice.
 *
 * Runs without listening on a port and without touching the
 * database. The trick is to populate `process.env` with enough
 * dummies BEFORE importing AppModule so `validateEnv()` passes; the
 * drizzle pool stays unused because we never invoke a repo.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const requiredDummies: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://noop:noop@localhost:5432/noop',
  JWT_ACCESS_SECRET: 'x'.repeat(64),
  JWT_REFRESH_SECRET: 'x'.repeat(64),
  JWT_ISSUER: 'telerady',
  JWT_AUDIENCE: 'telerady',
  ENCRYPTION_MASTER_KEY: 'a'.repeat(64),
  PSEUDONYM_PEPPER: 'b'.repeat(64),
  PORT: '3000',
  CORS_ORIGINS: 'http://localhost',
  LOG_LEVEL: 'silent',
};
for (const [k, v] of Object.entries(requiredDummies)) {
  if (!process.env[k]) process.env[k] = v;
}

// Imports happen AFTER the env is populated so config validation passes.
(async () => {
  const { NestFactory } = await import('@nestjs/core');
  const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
  const { AppModule } = await import('../src/app.module');

  // Without `abortOnError: false`, a DI failure makes Nest call
  // process.exit(1) directly and we lose the actual cause.
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  const config = new DocumentBuilder()
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
    })
    .setTitle('Telerady API')
    .setDescription('Telerady — teleradiology platform API (v1)')
    .setVersion('1.0')
    .build();

  const doc = SwaggerModule.createDocument(app, config);
  const outDir = join(__dirname, '..', '..', '..', 'docs');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'openapi.json');
  writeFileSync(outFile, JSON.stringify(doc, null, 2) + '\n', 'utf8');

  await app.close();

  // eslint-disable-next-line no-console
  console.log(`Wrote ${outFile}`);
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
