/*
 * Service worker: keeps the typesetter working offline.
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Generated at build time (vite.config.ts fills in VERSION and PRECACHE).
 * - Pages: network first, so a new deploy shows up at once; the cached copy
 *   is used when offline.
 * - Built assets (hashed names) and fonts: cache first. The app and its
 *   default fonts are cached on install; optional fonts when first used.
 * - Other sites (e.g. the Read Photo API) are never touched.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = 'cmnt-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cmnt-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req, { ignoreSearch: true })
            .then((hit) => hit || caches.match(url.pathname.endsWith('/manual.html') ? 'docs/manual.html' : 'index.html')),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/icons/'))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
