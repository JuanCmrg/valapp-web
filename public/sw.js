// Service worker mínimo para que Chrome / Android consideren la app
// "instalable". No cacheamos nada porque los datos financieros tienen
// que ser frescos en cada carga — solo dejamos pasar las requests.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network-only. No interceptamos.
});
