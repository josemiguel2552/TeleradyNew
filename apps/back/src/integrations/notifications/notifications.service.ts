import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface WebhookPayload {
  url: string;
  event: string;
  body: Record<string, unknown>;
}

/**
 * Outbound notifications.
 *
 * Email: provider-agnostic. In Sprint 7 we only log the payload (so the
 * platform works in dev without a SMTP server) and expose a stable
 * `send()` interface; Sprint 8 swaps the implementation for a real
 * provider (AWS SES eu-south-2, Mailgun EU, Postmark EU, etc.).
 *
 * Webhook: HMAC-SHA256 signed body, three retries with linear backoff.
 * The secret comes from `WEBHOOK_OUTGOING_SECRET` — rotating it
 * invalidates all subscribers and forces them to re-pull.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly emailFrom: string;
  private readonly webhookSecret: string | null;

  constructor(config: ConfigService) {
    this.emailFrom = config.get<string>('EMAIL_FROM') ?? 'no-reply@telerady.es';
    this.webhookSecret = config.get<string>('WEBHOOK_OUTGOING_SECRET') ?? null;
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    // No transport configured in dev; we log a structured event that the
    // operator can grep for. Production swaps this to a real provider.
    this.logger.log({
      kind: 'email',
      from: this.emailFrom,
      to: payload.to,
      subject: payload.subject,
      textPreview: payload.text.slice(0, 200),
    });
  }

  async fireWebhook(payload: WebhookPayload): Promise<void> {
    if (!this.webhookSecret) {
      this.logger.warn('WEBHOOK_OUTGOING_SECRET is not set; skipping webhook');
      return;
    }
    const bodyJson = JSON.stringify({
      event: payload.event,
      timestamp: new Date().toISOString(),
      body: payload.body,
    });
    const signature = createHmac('sha256', this.webhookSecret).update(bodyJson).digest('hex');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await fetch(payload.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telerady-Signature': `sha256=${signature}`,
            'X-Telerady-Event': payload.event,
          },
          body: bodyJson,
        });
        if (res.ok) return;
        this.logger.warn(
          `webhook ${payload.url} attempt ${attempt} returned ${res.status}`,
        );
      } catch (err) {
        this.logger.warn(
          `webhook ${payload.url} attempt ${attempt} failed: ${(err as Error).message}`,
        );
      }
      await delay(attempt * 500);
    }
    this.logger.error(`webhook ${payload.url} exhausted retries`);
  }
}
