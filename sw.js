// Service Worker untuk SIGAP AURA - Web Push Notification (iPhone & Android)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Menangani event PUSH dari Server
self.addEventListener('push', (event) => {
  const defaultIcon = new URL('/icon-192.png', self.location.origin).href;
  let data = {
    title: 'SIGAP AURA',
    body: 'Anda memiliki pemberitahuan baru dari PKBM Aura Anugerah.',
    url: '/portal',
    icon: defaultIcon,
    tag: 'sigap-notification'
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    }
  } catch (err) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const iconUrl = (data.icon && data.icon.startsWith('http')) ? data.icon : new URL(data.icon || '/icon-192.png', self.location.origin).href;

  const options = {
    body: data.body,
    icon: iconUrl,
    tag: data.tag || 'sigap-' + Date.now(),
    data: {
      id: data.id || ('NOTIF-' + Date.now()),
      title: data.title || 'SIGAP AURA',
      body: data.body || '',
      tag: data.tag || '',
      url: data.url || '/portal',
      timestamp: Date.now()
    },
    vibrate: [100, 50, 100],
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Menangani klik notifikasi pada HP (Android & iOS)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const rawUrl = notifData.url || '/portal';
  const fullTargetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Jika ada tab / window SIGAP AURA yang sedang terbuka di browser / PWA HP, bawa ke depan & kirim perintah navigasi
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            const targetClient = focusedClient || client;
            if (targetClient && targetClient.postMessage) {
              targetClient.postMessage({
                action: 'HANDLE_NOTIFICATION_CLICK',
                url: rawUrl,
                data: notifData
              });
            }
            if (targetClient && 'navigate' in targetClient && targetClient.url !== fullTargetUrl) {
              return targetClient.navigate(fullTargetUrl);
            }
            return targetClient;
          }).catch(() => {
            if (self.clients.openWindow) return self.clients.openWindow(fullTargetUrl);
          });
        }
      }
      // 2. Jika belum ada jendela aktif, buka window baru ke target URL
      if (self.clients && self.clients.openWindow) {
        return self.clients.openWindow(fullTargetUrl);
      }
    })
  );
});
