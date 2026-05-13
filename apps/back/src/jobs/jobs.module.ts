import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Hl7v2Module } from '../integrations/hl7v2/hl7v2.module';
import { AuditQueueWorker } from './workers/audit-queue.worker';
import { OruSenderWorker } from './workers/oru-sender.worker';
import { SlaEscalationWorker } from './workers/sla-escalation.worker';
import { WebhookWorker } from './workers/webhook.worker';
import { JobsService } from './jobs.service';
import { JobsHealthController } from './jobs-health.controller';

const QUEUES = ['sla-escalation', 'oru-sender', 'webhook-delivery', 'audit-verify'] as const;

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url) {
          // BullMQ requires Redis. In dev without Redis we still register
          // the module but every job becomes a no-op via a stub connection.
          return { connection: { host: '127.0.0.1', port: 6379 } };
        }
        const parsed = new URL(url);
        return {
          connection: {
            host: parsed.hostname,
            port: Number(parsed.port || 6379),
            password: parsed.password || undefined,
            username: parsed.username || undefined,
          },
        };
      },
    }),
    ...QUEUES.map((name) => BullModule.registerQueue({ name })),
    // OruSenderWorker depends on Hl7MllpClient — without this import
    // the DI graph fails to build at boot (caught when running the
    // OpenAPI export script in Sprint 36).
    Hl7v2Module,
  ],
  controllers: [JobsHealthController],
  providers: [
    JobsService,
    SlaEscalationWorker,
    OruSenderWorker,
    WebhookWorker,
    AuditQueueWorker,
  ],
  exports: [BullModule, JobsService],
})
export class JobsModule {}
