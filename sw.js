/* ============================================================
   sw.js — Service Worker for Money follow
   Caches the app shell for offline use, including third-party
   CDN libraries (Dexie, Tailwind, Chart.js, jsPDF, SheetJS,
   fonts) so a fully offline cold start still works.

   IMPORTANT FIX (v3): cross-origin <script src> tags are fetched
   by the browser in "no-cors" mode, which makes the Service
   Worker see an *opaque* response — status is always 0, even on
   success. The old runtime cache only stored responses whose
   status was exactly 200, so these opaque CDN responses were
   NEVER cached. That meant: after the app was closed and the
   phone went offline, reopening the app (cold start) could not
   load Dexie/Tailwind/etc. at all → the whole page failed to
   render even though the actual data in IndexedDB was always
   safe and untouched. This version explicitly precaches every
   external library with a real CORS fetch (these CDNs all send
   Access-Control-Allow-Origin headers, so this succeeds and
   yields a fully readable, cacheable 200 response), and the
   runtime handler now also accepts opaque responses as a
   fallback safety net.
   ============================================================ */

const CACHE_VERSION = 'v3';
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
  './js/icons.js',
  './js/boot-guard.js',
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

// Every third-party library the app depends on to even boot. These are
// fetched with an explicit CORS request during install so they land in
// the cache as fully readable, replayable 200 responses — not opaque.
const EXTERNAL_ASSETS = [
  'https://unpkg.com/dexie@3/dist/dexie.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // The app's own shell MUST all succeed — this is the minimum needed
      // for the app to work offline at all.
      await cache.addAll(APP_SHELL);

      // External CDN libraries are cached independently of each other so
      // one slow/unreachable CDN during install never blocks the app
      // shell (and therefore never blocks offline availability).
      await Promise.all(
        EXTERNAL_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { mode: 'cors' });
            if (res && res.ok) await cache.put(url, res);
          } catch (e) {
            // Will still get opportunistically cached on the next
            // successful online load via the fetch handler below.
          }
        })
      );

      self.skipWaiting();
    })()
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
          // Cache normal same-origin 200 responses AND opaque cross-origin
          // responses (status is always reported as 0 for opaque
          // responses even when the real HTTP request succeeded — they
          // are still perfectly valid to store and replay offline).
          if (response && (response.status === 200 || response.type === 'opaque')) {
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
