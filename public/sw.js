// Service worker for Web Push only — deliberately no offline caching, so it can never serve a
// stale attendance or leave screen.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Innovin Internal";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      // Same tag replaces an earlier notification instead of stacking duplicates.
      tag: data.tag || title,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { href: data.href || "/" },
    }),
  );
});

// Focus an existing tab if one is open, rather than piling up new ones.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(href);
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
