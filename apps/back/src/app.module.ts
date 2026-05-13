import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { RlsContextInterceptor } from './common/tenant/rls-context.interceptor';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { AuditLogModule } from './common/audit/audit-log.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { I18nModule } from './i18n/i18n.module';
import { JobsModule } from './jobs/jobs.module';
import { MeModule } from './me/me.module';
import { MetricsModule } from './metrics/metrics.module';
import { FhirModule } from './integrations/fhir/fhir.module';
import { Hl7v2Module } from './integrations/hl7v2/hl7v2.module';
import { NotificationsModule } from './integrations/notifications/notifications.module';
import { OrthancModule } from './integrations/orthanc/orthanc.module';
import { StorageModule } from './integrations/storage/storage.module';
import { ParametersModule } from './parameters/parameters.module';
import { PersonalDataModule } from './personal-data/personal-data.module';
import { ProfessionalDocumentModule } from './professional-document/professional-document.module';
import { ReportModule } from './reports/reports.module';
import { ReportsV2Module } from './reports/v2/reports-v2.module';
import { UserEventsModule } from './user-events/user-events.module';
import { WorklistModule } from './worklist/worklist.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { validateEnv } from './config/env.schema';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.fileBase64',
  'res.headers["set-cookie"]',
  '*.password',
  '*.bankAccount',
  '*.bank_account',
  '*.iban',
  '*.dni',
  '*.patName',
  '*.pat_name',
  '*.patBirthdate',
  '*.pat_birthdate',
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => validateEnv(raw),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
          serializers: {
            req: (req) => ({
              method: req.method,
              url: req.url,
              remoteAddress: req.remoteAddress,
            }),
          },
          customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: (config.get<number>('THROTTLE_TTL') ?? 60) * 1000,
          limit: config.get<number>('THROTTLE_LIMIT') ?? 120,
        },
      ],
    }),
    CryptoModule,
    MetricsModule,
    AuditLogModule,
    AuthModule,
    I18nModule,
    FhirModule,
    Hl7v2Module,
    NotificationsModule,
    OrthancModule,
    StorageModule,
    UserEventsModule,
    PersonalDataModule,
    ProfessionalDocumentModule,
    ReportModule,
    ReportsV2Module,
    ParametersModule,
    WorklistModule,
    AdminModule,
    MeModule,
    WorkflowsModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // RlsContextInterceptor self-gates on RLS_ENABLED — registered
    // globally is safe in dev (it short-circuits to next.handle()) and
    // becomes the production tenant gate once the migration in
    // infra/migrations/001-enable-rls.sql is applied and the env flips
    // RLS_ENABLED to "true". See docs/RLS-ACTIVATION-RUNBOOK.md.
    {
      provide: APP_INTERCEPTOR,
      useClass: RlsContextInterceptor,
    },
  ],
})
export class AppModule {}
