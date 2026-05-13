import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface PublicKeyResponse {
  publicKey: string | null;
}
interface SubscriptionResponse {
  id: string;
  createdAt: string;
  userAgent: string | null;
}

/**
 * Wraps the Notification + PushManager API and the back's
 * `/v1/push/...` endpoints.
 *
 * The SW (`/sw.js`) is registered the first time the user enables
 * notifications — never on boot, so the platform stays a regular SPA
 * for users who don't opt in. Browser permission state is mirrored
 * into a signal so the admin/me toggle can react.
 */
@Injectable({ providedIn: 'root' })
export class PushSubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiTelerady.replace(/\/v1$/, '');

  readonly supported = signal<boolean>(
    typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window,
  );
  readonly permission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  readonly enabled = signal<boolean>(false);
  readonly subscriptionId = signal<string | null>(null);

  /**
   * Idempotent. Asks the browser for permission (if not granted yet),
   * registers the SW and pushes the resulting PushSubscription up to
   * `/v1/me/push/subscriptions`. Returns true if the device is now
   * subscribed.
   */
  async enable(): Promise<boolean> {
    if (!this.supported()) return false;
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    this.permission.set(perm);
    if (perm !== 'granted') return false;

    const { publicKey } = await firstValueFrom(
      this.http.get<PublicKeyResponse>(`${this.base}/v1/push/public-key`),
    );
    if (!publicKey) return false;

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const json = sub.toJSON();
    const res = await firstValueFrom(
      this.http.post<SubscriptionResponse>(
        `${this.base}/v1/me/push/subscriptions`,
        {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys!['p256dh'], auth: json.keys!['auth'] },
          userAgent: navigator.userAgent,
        },
      ),
    );
    this.subscriptionId.set(res.id);
    this.enabled.set(true);
    return true;
  }

  /**
   * Revoke server-side AND unsubscribe locally. After this the back
   * stops sending pushes to this device; the browser keeps the SW
   * registered (cheap) but no further notifications will surface.
   */
  async disable(): Promise<void> {
    const id = this.subscriptionId();
    if (id) {
      await firstValueFrom(
        this.http.delete(`${this.base}/v1/me/push/subscriptions/${encodeURIComponent(id)}`),
      );
      this.subscriptionId.set(null);
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe().catch(() => undefined);
    }
    this.enabled.set(false);
  }
}

/**
 * VAPID public keys arrive as URL-safe base64 (per RFC 8292). The
 * PushManager.subscribe() applicationServerKey wants the raw bytes.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
