'use strict';
// v6 löschte v5 mit: darin lagen fälschlich auch Dateien der Poster-App.
// v7: Die App liegt jetzt unter /raum/ statt an der Wurzel, alle Pfade des
// Caches ändern sich damit.
//
// Umzug nach Privat-Projekte: Diese Kopie und das Original unter /Arbeit/raum/
// liegen auf derselben Herkunft (flog93.github.io) und teilen sich damit den
// Cache-Speicher. Mit dem alten Namen würde jede Aktualisierung der einen die
// Caches der anderen löschen und ihr den Offline-Betrieb nehmen – deshalb ein
// eigenes Präfix. Gezählt wird hier neu bei v1.
const CACHE_PREFIX = 'pp-raumrechner-';
const CACHE = CACHE_PREFIX + 'v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './fonts/hanken-grotesk-latin.woff2',
  './fonts/space-grotesk-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
];

// Der Scope dieses Workers ist seit dem Umzug nach /raum/ nur noch die eigene
// App. Gecacht wird trotzdem ausschließlich der eigene App-Shell — vorher schluckte der Worker jede Anfrage im Scope und
// lieferte der Poster-App eingefrorene Dateien aus, bis hin zu neuem HTML mit
// altem JavaScript.
const SHELL = new Set(ASSETS.map((p) => new URL(p, self.location).pathname));

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // Nur eigene Altstände: „alles außer meinem Cache" hat bisher auch die
      // Caches der anderen Apps auf dieser Herkunft gelöscht und ihnen bei
      // jeder Aktualisierung dieser App den Offline-Betrieb genommen.
      .then(keys => Promise.all(keys.filter(k => k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for the app shell, falling back to network and refreshing the
// cache in the background — keeps the calculator usable offline on site.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (!SHELL.has(url.pathname)) return; // fremde Apps im Scope unangetastet lassen

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
