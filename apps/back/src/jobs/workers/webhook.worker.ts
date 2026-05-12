import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { WebhookJobPayload } from '../jobs.service';

@Processor('webhook-delivery')
export class WebhookWorker extends WorkerHost {
  private readonly logger = new Logger(WebhookWorker.name);
  private readonly secret: string | null;

  constructor(config: ConfigService) {
    super();
    this.secret = config.get<string>('WEBHOOK_OUTGOING_SECRET') ?? null;
  }

  async process(job: Job<WebhookJobPayload>): Promise<{ status: number }> {
    if (!this.secret) {
      this.logger.warn('WEBHOOK_OUTGOING_SECRET not set; dropping webhook');
      return { status: 0 };
    }
    const body = JSON.stringify({
      event: job.data.event,
      timestamp: new Date().toISOString(),
      body: job.data.body,
    });
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');
    const res = await fetch(job.data.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telerady-Signature': `sha256=${signature}`,
        'X-Telerady-Event': job.data.event,
        'X-Telerady-Attempt': String(job.attemptsMade + 1),
      },
      body,
    });
    if (!res.ok) throw new Error(`webhook returned ${res.status}`);
    return { status: res.status };
  }
}
