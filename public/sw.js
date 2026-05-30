/* PerformTrack Service Worker — silent background updates */
/* Bump CACHE_VERSION to force a new SW install on deploy. */
const CACHE_VERSION = 'pt-v__BUILD_ID__';
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

self.addEventListener('install', (event) => {
  // Activate the new SW as soon as it finishes installing — no waiting screen.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete ALL previous caches (any cache not matching current version).
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => !n.startsWith(CACHE_VERSION)).map((n) => caches.delete(n))
    );
    // Take control of open clients immediately.
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// NetworkFirst for navigations + same-origin GETs so users never see a stale shell.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache auth/oauth callbacks or API/edge calls.
  if (url.pathname.startsWith('/~oauth') || url.pathname.startsWith('/functions/')) return;

  const isNavigation = req.mode === 'navigate';

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      // Only cache successful, basic responses for static assets — not HTML navigations.
      if (!isNavigation && fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (isNavigation) {
        const shell = await caches.match('/');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
