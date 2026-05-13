// Telerady Service Worker — Web Push handler.
//
// Intentionally minimal: no offline caching, no background sync. The
// only responsibility is to receive the push payload the back sends
// via VAPID and surface it as a system notification that opens the
// right deep link when tapped. Angular's own Service Worker is not
// enabled because we don't want the SPA shell to cache aggressively
// in a healthcare context where a stale read could be surprising.

self.addEventListener('install', (event) => {
  // Take over immediately so the first push after registration works.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (_err) {
    payload = { title: 'Telerady', body: event.data.text() };
  }
  const title = payload.title || 'Telerady';
  const options = {
    body: payload.body || '',
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: payload.url || '/' },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Reuse a tab on the same origin if there's one — better UX than
      // opening a duplicate.
      for (const client of all) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          await client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return null;
    })(),
  );
});
