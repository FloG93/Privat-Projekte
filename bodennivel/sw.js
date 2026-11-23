'use strict';
// Cache-Version bei JEDER Dateiänderung hochzählen – sonst bekommen installierte
// Geräte weiter die alten Dateien aus dem Cache.
//
// Alle Apps dieses Repositories liegen auf derselben Herkunft
// (flog93.github.io) und teilen sich den Cache-Speicher. Deshalb hat dieser
// Worker ein eigenes Präfix, beantwortet nur seine eigenen Dateien (SHELL) und
// löscht beim Aktivieren nur eigene Altstände.
const CACHE_PREFIX = 'pp-bodennivel-';
const CACHE = CACHE_PREFIX + 'v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/calc.js',
  './js/format.js',
  './js/grid.js',
  './js/model.js',
  './js/store.js',
  './js/ui/dashboard.js',
  './js/ui/dom.js',
  './js/ui/entry-bar.js',
  './js/ui/laser-dialog.js',
  './js/ui/plan-svg.js',
  './js/ui/print.js',
  './js/ui/room.js',
  './js/ui/types.js',
  './js/main.js',
  './icons/icon-192-maskable.png',
  './icons/icon-192.png',
  './icons/icon-512-maskable.png',
  './icons/icon-512.png',
  './vendor/lucide/icons/check.svg',
  './vendor/lucide/icons/chevron-left.svg',
  './vendor/lucide/icons/crosshair.svg',
  './vendor/lucide/icons/download.svg',
  './vendor/lucide/icons/layers.svg',
  './vendor/lucide/icons/move.svg',
  './vendor/lucide/icons/pencil.svg',
  './vendor/lucide/icons/plus.svg',
  './vendor/lucide/icons/printer.svg',
  './vendor/lucide/icons/settings.svg',
  './vendor/lucide/icons/skip-forward.svg',
  './vendor/lucide/icons/trash-2.svg',
  './vendor/lucide/icons/triangle-alert.svg',
  './vendor/lucide/icons/undo-2.svg',
  './vendor/lucide/icons/upload.svg',
  './vendor/lucide/icons/x.svg',
  './favicon.svg',
  '../shared/css/ui.css',
  '../shared/js/theme.js',
];

const SHELL = new Set(ASSETS.map((p) => new URL(p, self.location).pathname));

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache zuerst, im Hintergrund aktualisieren: Die App bleibt auf der Baustelle
// ohne Netz benutzbar.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (!SHELL.has(url.pathname)) return; // Fremdes im Scope unangetastet lassen

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
