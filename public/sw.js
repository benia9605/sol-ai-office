/**
 * @file public/sw.js
 * @description Service Worker — 푸시 알림 수신 + 클릭 핸들링
 * - push 이벤트: showNotification() 호출
 * - notificationclick: 앱 열기/포커스 + URL 네비게이션
 * - fetch 캐싱은 하지 않음 (Vite 빌드 해시와 충돌 방지)
 */

// --- 설치 ---
self.addEventListener('install', () => {
  self.skipWaiting();
});

// --- 활성화 ---
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- 푸시 알림 수신 ---
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('[SW] push data parse error:', e);
    data = { title: 'Teamie', body: '새 알림이 있습니다' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Teamie', {
      body: data.body || '',
      icon: '/icon-192x192.png',
      badge: '/favicon-32x32.png',
      tag: data.tag || 'default',
      data: { url: data.url || '/' },
    })
  );
});

// --- 알림 클릭 → 앱 열기/포커스 ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
