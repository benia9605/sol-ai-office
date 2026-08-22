/* eslint-disable no-restricted-globals */

// 밋업 Service Worker — Web Push 수신 + 클릭 핸들링
// 캐싱은 비활성 (정적 자산은 Replit 정적 호스팅 + 브라우저 캐시에 위임).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ============================================================
// 푸시 수신 — try/catch 필수
// ============================================================
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error("[meetup-sw] push payload parse error", e);
    data = { title: "새 알림", body: "앱을 열어서 확인해 주세요." };
  }

  const title = data.title || "밋업";
  const options = {
    body: data.body || "",
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    tag: data.tag || "meetup-default",
    data: { url: data.url || "/dashboard" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================
// 알림 클릭 → 앱 포커스 + 해당 URL 로 이동
// ============================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (new URL(client.url).origin === self.location.origin) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
