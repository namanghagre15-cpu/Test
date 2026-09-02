/* ============================================================
   sw.js — Service Worker
   Caches the app shell for offline use. Network requests to
   third-party CDNs (Tailwind, Dexie, Chart.js, Google Fonts)
   are cached opportunistically (stale-while-revalidate) so the
   app keeps working after the first successful load.
   ============================================================ */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `expense-tracker-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './add.html',
  './wallet.html',
  './stats.html',
  './vault.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/nav.js',
  './js/app.js',
  './js/add.js',
  './js/wallet.js',
  './js/stats.js',
  './js/vault.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Only cache successful, same-origin-or-cors-ok responses
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // Stale-while-revalidate: serve cache immediately if present,
      // otherwise wait on the network.
      return cached || networkFetch;
    })
  );
});
