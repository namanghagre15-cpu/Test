/* ============================================================
   sw.js — Service Worker for Money follow
   Caches the app shell for offline use. Third-party CDN assets
   (Tailwind, Dexie, Chart.js, jsQR, jsPDF, SheetJS, fonts) are
   cached opportunistically (stale-while-revalidate) so the app
   keeps working offline after the first successful load.
   ============================================================ */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `money-follow-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './add.html',
  './wallet.html',
  './stats.html',
  './vault.html',
  './history.html',
  './khata.html',
  './settings.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/nav.js',
  './js/theme.js',
  './js/ghost.js',
  './js/lock.js',
  './js/app.js',
  './js/add.js',
  './js/wallet.js',
  './js/stats.js',
  './js/vault.js',
  './js/history.js',
  './js/khata.js',
  './js/settings.js',
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
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
