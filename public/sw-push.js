/* Service Worker Push Notifications, Notification Click & Background Sync handler */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Uber Driver UK',
    body: 'New driver alert — tap to open Uber Driver',
    tag: 'uber-driver-push',
    url: '/?action=home',
    badgeCount: 1,
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  const showPromise = self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || 'uber-driver-push',
    renotify: true,
    data: { url: payload.url || '/' },
  });

  const badgePromise =
    typeof payload.badgeCount === 'number' &&
    self.navigator &&
    typeof self.navigator.setAppBadge === 'function'
      ? payload.badgeCount > 0
        ? self.navigator.setAppBadge(payload.badgeCount).catch(() => {})
        : self.navigator.clearAppBadge().catch(() => {})
      : Promise.resolve();

  event.waitUntil(Promise.all([showPromise, badgePromise]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({
              type: 'UBER_PUSH_CLICK',
              url: targetUrl,
            });
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'uber-offline-sync') {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            client.postMessage({ type: 'UBER_FLUSH_OFFLINE_QUEUE' });
          }
        })
    );
  }
});
