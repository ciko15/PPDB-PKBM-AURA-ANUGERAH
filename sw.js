// Service Worker untuk SIGAP AURA - Web Push Notification (iPhone & Android)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Menangani event PUSH dari Server
self.addEventListener('push', (event) => {
  let data = {
    title: 'SIGAP AURA',
    body: 'Anda memiliki pemberitahuan baru dari PKBM Aura Anugerah.',
    url: '/portal',
    icon: '/logo_PKBM_Aura_Anugerah_transparan.png',
    badge: '/logo_PKBM_Aura_Anugerah_transparan.png',
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

  const options = {
    body: data.body,
    icon: data.icon || '/logo_PKBM_Aura_Anugerah_transparan.png',
    badge: data.badge || '/logo_PKBM_Aura_Anugerah_transparan.png',
    tag: data.tag || 'sigap-' + Date.now(),
    data: {
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

  const rawUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/portal';
  const fullTargetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Jika ada tab / window SIGAP AURA yang sedang terbuka di browser / PWA HP
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && client.url !== fullTargetUrl) {
            client.navigate(fullTargetUrl);
          }
          return client.focus();
        }
      }
      // 2. Jika belum ada jendela aktif, buka window baru ke target URL
      if (self.clients && self.clients.openWindow) {
        return self.clients.openWindow(fullTargetUrl);
      }
    })
  );
});
