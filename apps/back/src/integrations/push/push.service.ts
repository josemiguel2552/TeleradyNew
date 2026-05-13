import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull, sql } from 'drizzle-orm';
import webPush, { type PushSubscription as WPSubscription } from 'web-push';
import { db } from '../../database/drizzle';
import { pushSubscriptionInTelerady } from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { MetricsService } from '../../metrics/metrics.service';
import type { CreatePushSubscriptionDto } from './dto/push-subscription.dto';

export interface PushPayload {
  title: string;
  body: string;
  /** Path the SW opens when the user taps the notification. */
  url?: string;
  /** Tag used to dedupe consecutive notifications about the same study. */
  tag?: string;
  /** Stable hint for the audit row ("study_assigned", "study_urgent", …). */
  category?: string;
}

interface SendResult {
  delivered: number;
  reaped: number;
  failed: number;
}

/**
 * Web Push (RFC 8292) — central place to (un)register subscriptions
 * and to fire notifications to a user's devices.
 *
 * The platform never stores the push *payload*: only the subscriber
 * endpoint + the two short keys the browser hands out. Audit rows
 * contain the category and the count of devices reached, never the
 * notification title or body — the body can carry the study
 * description and we don't want PHI in audit_log.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey: string | null;
  private readonly privateKey: string | null;
  private readonly subject: string;

  constructor(
    config: ConfigService,
    private readonly audit: AuditLogService,
    private readonly metrics: MetricsService,
  ) {
    this.publicKey = config.get<string>('VAPID_PUBLIC_KEY') ?? null;
    this.privateKey = config.get<string>('VAPID_PRIVATE_KEY') ?? null;
    this.subject = config.get<string>('VAPID_SUBJECT') ?? 'mailto:ops@telerady.es';
    if (this.configured) {
      webPush.setVapidDetails(this.subject, this.publicKey!, this.privateKey!);
    }
  }

  get configured(): boolean {
    return !!this.publicKey && !!this.privateKey;
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  async subscribe(
    userId: string,
    dto: CreatePushSubscriptionDto,
  ): Promise<{ id: string; createdAt: string; userAgent: string | null }> {
    // The endpoint is the natural key; if the same device re-subscribes
    // we resurrect the row (revoked_at NULL) instead of creating a
    // duplicate. A trailing UPDATE refreshes the keys in case the
    // browser rotated them.
    const [row] = await db
      .insert(pushSubscriptionInTelerady)
      .values({
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionInTelerady.endpoint,
        set: {
          userId,
          p256dh: dto.keys.p256dh,
          auth: dto.keys.auth,
          userAgent: dto.userAgent ?? null,
          revokedAt: null,
        },
      })
      .returning({
        id: pushSubscriptionInTelerady.id,
        createdAt: pushSubscriptionInTelerady.createdAt,
        userAgent: pushSubscriptionInTelerady.userAgent,
      });
    return { id: row.id, createdAt: row.createdAt, userAgent: row.userAgent ?? null };
  }

  async unsubscribe(userId: string, subscriptionId: string): Promise<void> {
    await db
      .update(pushSubscriptionInTelerady)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(pushSubscriptionInTelerady.id, subscriptionId),
          eq(pushSubscriptionInTelerady.userId, userId),
        ),
      );
  }

  /**
   * Send a payload to every active device of a user. Subscriptions
   * that return 404/410 (the push service forgot them) are reaped
   * automatically so we don't retry them on the next call.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
    if (!this.configured) {
      this.logger.debug('Push not configured; dropping notification');
      return { delivered: 0, reaped: 0, failed: 0 };
    }
    const subs = await db
      .select({
        id: pushSubscriptionInTelerady.id,
        endpoint: pushSubscriptionInTelerady.endpoint,
        p256dh: pushSubscriptionInTelerady.p256dh,
        auth: pushSubscriptionInTelerady.auth,
      })
      .from(pushSubscriptionInTelerady)
      .where(
        and(
          eq(pushSubscriptionInTelerady.userId, userId),
          isNull(pushSubscriptionInTelerady.revokedAt),
        ),
      );

    let delivered = 0;
    let reaped = 0;
    let failed = 0;
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
      tag: payload.tag ?? null,
    });

    for (const sub of subs) {
      const target: WPSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webPush.sendNotification(target, body, { TTL: 600 });
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.markRevoked(sub.id);
          reaped += 1;
        } else {
          this.logger.warn(`push to ${sub.endpoint.slice(0, 40)}… failed: ${(err as Error).message}`);
          failed += 1;
        }
      }
    }

    this.metrics.pushNotifications.labels(payload.category ?? 'generic', 'delivered').inc(delivered);
    this.metrics.pushNotifications.labels(payload.category ?? 'generic', 'reaped').inc(reaped);
    this.metrics.pushNotifications.labels(payload.category ?? 'generic', 'failed').inc(failed);

    await this.audit.append({
      actorId: null,
      actorRole: 'system',
      hospitalId: null,
      action: 'push.notification_sent',
      targetKind: 'AppUser',
      targetId: userId,
      payload: {
        category: payload.category ?? 'generic',
        devices: subs.length,
        delivered,
        reaped,
        failed,
        // title/body intentionally omitted — they can carry the study
        // description which we treat as PHI-adjacent.
      },
    });

    return { delivered, reaped, failed };
  }

  private async markRevoked(id: string): Promise<void> {
    await db
      .update(pushSubscriptionInTelerady)
      .set({ revokedAt: sql`now()` })
      .where(eq(pushSubscriptionInTelerady.id, id));
  }
}
