// Diese App bringt keinen Service Worker mit. Der Raumrechner liegt aber auf
// derselben Herkunft, und sein Worker hat die ganze Site im Scope: ältere
// Fassungen cachten deshalb auch diese App und lieferten sie danach eingefroren
// aus — bis hin zu neuem HTML mit altem JavaScript, was die Initialisierung
// abbrechen ließ und die Suche tot zurückließ.
//
// Der Worker ist repariert, erreicht aber nur Geräte, die ihn nachladen. Bis
// dahin räumt die Seite ihre eigenen Einträge selbst aus jedem Cache, stößt die
// Aktualisierung an und lädt einmalig neu, wenn sie tatsächlich alte Dateien
// vorgefunden hat. Läuft überall sonst als No-Op durch.
//
// Muss vor allen anderen Skripten stehen: es ist die Rettungsleine, wenn die
// übrige App an genau diesem Problem scheitert.
(function () {
  if (!('serviceWorker' in navigator) || !window.caches) return;

  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.update().catch(() => {})))
    .catch(() => {});

  const here = new URL('./', location.href).pathname;

  caches.keys()
    .then((names) => Promise.all(names.map((name) => caches.open(name).then((cache) =>
      cache.keys().then((reqs) => {
        const mine = reqs.filter((r) => new URL(r.url).pathname.startsWith(here));
        return Promise.all(mine.map((r) => cache.delete(r))).then(() => mine.length);
      })
    ))))
    .then((counts) => {
      const purged = counts.reduce((a, b) => a + b, 0);
      if (!purged || !navigator.serviceWorker.controller) return;
      // Die Skripte dieser Ladung kamen noch aus dem alten Cache — einmal neu
      // laden holt sie frisch. Das Flag verhindert eine Schleife.
      try {
        if (sessionStorage.getItem('posterapp.cachefix')) return;
        sessionStorage.setItem('posterapp.cachefix', '1');
      } catch (e) {
        return; // ohne sessionStorage lieber gar nicht neu laden
      }
      location.reload();
    })
    .catch(() => {});
})();
