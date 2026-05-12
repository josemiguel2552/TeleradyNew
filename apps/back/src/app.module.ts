import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AuditLogModule } from './common/audit/audit-log.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { I18nModule } from './i18n/i18n.module';
import { ParametersModule } from './parameters/parameters.module';
import { PersonalDataModule } from './personal-data/personal-data.module';
import { ProfessionalDocumentModule } from './professional-document/professional-document.module';
import { ReportModule } from './reports/reports.module';
import { UserEventsModule } from './user-events/user-events.module';
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
    AuditLogModule,
    AuthModule,
    I18nModule,
    UserEventsModule,
    PersonalDataModule,
    ProfessionalDocumentModule,
    ReportModule,
    ParametersModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
