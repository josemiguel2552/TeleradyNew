import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

export interface SlaJobPayload {
  /** Operator id whose context will be recorded in the audit row. */
  actorId: string;
  minutes: number;
}

export interface WebhookJobPayload {
  url: string;
  event: string;
  body: Record<string, unknown>;
}

export interface OruJobPayload {
  host: string;
  port: number;
  payload: string;
  hospitalId?: string | null;
  controlId?: string;
  messageType: string;
}

export interface AuditJobPayload {
  /** ISO timestamp at which the verify run was triggered. */
  scheduledAt: string;
}

/**
 * Thin façade over the BullMQ queues. Feature services depend on this
 * instead of touching BullMQ directly so the wiring is testable.
 *
 * Repeat schedules:
 *   - SLA escalation: every 15 min while the API is up.
 *   - Audit verify: every hour.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsService.name);
  private readonly enabled: boolean;

  constructor(
    @InjectQueue('sla-escalation') private readonly slaQueue: Queue<SlaJobPayload>,
    @InjectQueue('oru-sender') private readonly oruQueue: Queue<OruJobPayload>,
    @InjectQueue('webhook-delivery') private readonly webhookQueue: Queue<WebhookJobPayload>,
    @InjectQueue('audit-verify') private readonly auditQueue: Queue<AuditJobPayload>,
    config: ConfigService,
  ) {
    this.enabled = Boolean(config.get<string>('REDIS_URL'));
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('REDIS_URL not set; jobs are registered but will not run');
      return;
    }
    await this.slaQueue.upsertJobScheduler('sla-escalation-15min', { pattern: '*/15 * * * *' }, {
      name: 'sla-escalation',
      data: { actorId: 'system', minutes: 24 * 60 },
    });
    await this.auditQueue.upsertJobScheduler('audit-verify-hourly', { pattern: '0 * * * *' }, {
      name: 'audit-verify',
      data: { scheduledAt: new Date().toISOString() },
    });
    this.logger.log('Recurring jobs scheduled: sla-escalation (15m) + audit-verify (1h)');
  }

  enqueueWebhook(payload: WebhookJobPayload, attempts = 5): Promise<void> {
    return this.webhookQueue.add('webhook', payload, {
      attempts,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: 500,
      removeOnFail: 200,
    }).then(() => undefined);
  }

  enqueueOru(payload: OruJobPayload, attempts = 5): Promise<void> {
    return this.oruQueue.add('oru', payload, {
      attempts,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: 500,
      removeOnFail: 200,
    }).then(() => undefined);
  }
}
