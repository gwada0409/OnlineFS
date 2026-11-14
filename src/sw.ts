/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/hubs/'), new NetworkOnly());
registerRoute(({ request }) => ['font', 'style'].includes(request.destination), new StaleWhileRevalidate({ cacheName: 'onlinefs-safe-fonts-v1', plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 })] }));
registerRoute(({ request, url }) => request.destination === 'image' && url.origin === self.location.origin, new CacheFirst({ cacheName: 'onlinefs-safe-images-v1', plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60 })] }));
registerRoute(new NavigationRoute(async ({ request }) => {
  try { return await fetch(request); }
  catch { return (await caches.match('/index.html')) ?? (await caches.match('/offline.html')) ?? Response.error(); }
}));

self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil((async () => {
    if ('setAppBadge' in self.navigator && Number.isFinite(data.badgeCount)) await (self.navigator as any).setAppBadge(data.badgeCount);
    await self.registration.showNotification(data.title || 'OnlineFS update', {
      body: data.message || 'A request has been updated.', icon: '/pwa-192x192.png', badge: '/pwa-192x192.png',
      tag: data.tag || `onlinefs-${data.id}`, data: { url: data.actionUrl || '/notifications', notificationId: data.id },
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin) as WindowClient | undefined;
    if (existing) { await existing.focus(); existing.navigate(target); }
    else await self.clients.openWindow(target);
  })());
});

self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
