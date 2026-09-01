// Service worker — Le Facturier (Websoft Enterprise)
// Stratégie : "stale-while-revalidate" pour l'app locale, "cache falling back to network"
// pour les ressources externes (polices, icônes, librairies CDN), afin de permettre
// une utilisation hors-ligne après un premier chargement.

const CACHE_VERSION = 'le-facturier-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manus-storage/logo_57078cae.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        // Si un des fichiers de l'app shell est introuvable au moment de l'installation,
        // on ne bloque pas l'installation du service worker pour autant.
      })
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // App locale : on sert le cache immédiatement si disponible, tout en
    // rafraîchissant le cache en arrière-plan (stale-while-revalidate).
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  } else {
    // Ressources externes (polices, icônes, librairies CDN) : cache d'abord,
    // puis réseau, pour permettre l'usage hors-ligne après un premier chargement.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
