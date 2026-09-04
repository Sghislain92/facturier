// Service worker — Le Facturier (Websoft Enterprise)
//
// Stratégie :
//  - Pages HTML (navigation) : "network-first" — on essaie TOUJOURS le réseau
//    en premier pour garantir la dernière version de l'app. Le cache ne sert
//    que de secours si l'utilisateur est hors-ligne. C'est ce qui évite qu'un
//    utilisateur reste bloqué sur une ancienne version périmée après une
//    correction ou une mise à jour.
//  - Ressources statiques (Tailwind, lucide, sweetalert2, html2pdf, polices,
//    images) : pré-mises en cache à l'installation (pour un premier usage
//    hors-ligne garanti dès l'installation de l'app) PUIS tenues à jour en
//    tâche de fond à chaque visite ("stale-while-revalidate").
//
// ⚠️ Incrémentez CACHE_VERSION à chaque déploiement important : cela force le
// nettoyage des anciens caches et le re-téléchargement des ressources.

const CACHE_VERSION = 'le-facturier-v7';

// Ressources de la même origine (mêmes règles CORS que le site).
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/images/logo.png',
  '/images/code-icon.png',
  '/images/icone.png'
];

// Ressources tierces (CDN) indispensables au bon fonctionnement de l'UI hors-ligne :
// Tailwind CSS (mise en forme), lucide (icônes), sweetalert2 (boîtes de dialogue),
// html2pdf (export PDF) et les polices utilisées dans le papier à en-tête.
// On ne cible que les points d'entrée : les sous-ressources qu'ils chargent
// eux-mêmes (woff2, sourcemaps...) sont interceptées et mises en cache au fil
// de l'eau par le gestionnaire "fetch" ci-dessous dès le premier chargement
// en ligne — inutile (et fragile) de coder en dur des URLs de polices qui
// changent au fil des mises à jour de Google Fonts.
const CDN_ENTRYPOINTS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=Jost:wght@400;500;600;700&display=swap'
];

// Beaucoup de ces ressources CDN ne renvoient pas d'en-têtes CORS pour un
// usage en balise <script>/<link> classique : la réponse est alors "opaque"
// (statut illisible par le navigateur). On force le mode no-cors pour éviter
// tout rejet, et on met en cache la réponse même opaque — c'est le seul moyen
// de garantir Tailwind/lucide/sweetalert2/html2pdf disponibles hors-ligne.
function cacheNoCors(cache, url) {
  return fetch(url, { mode: 'no-cors' })
    .then((response) => cache.put(url, response))
    .catch((error) => console.log('⚠️ Impossible de mettre en cache:', url, error));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled([
        ...APP_SHELL.map((url) => cache.add(url).catch((error) => console.log('⚠️ Impossible de mettre en cache:', url, error))),
        ...CDN_ENTRYPOINTS.map((url) => cacheNoCors(cache, url))
      ])
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

// Une réponse est utilisable pour la mise en cache si elle est soit un succès
// classique (response.ok), soit une réponse opaque cross-origin (statut non
// lisible mais valide) — sans ce deuxième cas, les ressources CDN chargées en
// no-cors (Tailwind, lucide, sweetalert2, html2pdf, polices) ne seraient
// jamais mises en cache.
function isCacheable(response) {
  return response && (response.ok || response.type === 'opaque');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // On n'intercepte que les requêtes GET.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.hostname.includes('google-analytics') || url.hostname.includes('googletagmanager')) return;

  // 1) Pages HTML : network-first, avec repli sur le cache si hors-ligne.
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // 2) Ressources statiques (images, polices, scripts CDN) : on sert le cache
  // immédiatement s'il existe (rapide, et fonctionne hors-ligne), tout en
  // rafraîchissant la version en cache en arrière-plan pour la prochaine fois.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// Permet à la page de forcer l'activation immédiate d'une nouvelle version.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Notifications push (optionnel, prêt si une infrastructure d'envoi est ajoutée plus tard).
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Nouvelle mise à jour disponible',
    icon: '/images/icone.png',
    badge: '/images/icone.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification('📄 Le Facturier', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
});
