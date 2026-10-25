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

// Menangani klik notifikasi pada HP
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/portal';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Jika tab/aplikasi sudah terbuka, bawa ke depan
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Jika belum terbuka, buka window baru
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
