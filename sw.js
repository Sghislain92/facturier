// Service worker — Le Facturier (Websoft Enterprise)
// Stratégie : "stale-while-revalidate" pour l'app locale, "cache falling back to network"
// pour les ressources externes (polices, icônes, librairies CDN), afin de permettre
// une utilisation hors-ligne après un premier chargement.

const CACHE_VERSION = 'le-facturier-v5';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/images/logo.png',
  '/images/code-icon.png',
  '/images/icone.png'
];

// Ressources CDN essentielles pour le fonctionnement hors ligne
const CDN_RESOURCES = [
  // Tailwind CSS
  'https://cdn.tailwindcss.com',
  'https://cdn.tailwindcss.com/3.4.1',
  
  // Lucide icons
  'https://unpkg.com/lucide@latest',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.js',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
  
  // Google Fonts - Jost (utilisée dans le HTML)
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap',
  
  // Font files Jost
  'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjJTVBNI0.woff2',
  'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjJTVhNI0.woff2',
  'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjJTVNNI0.woff2',
  'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjJTVTNI0.woff2',
  'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjJTVCNI0.woff2',
  'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjJTVENI0.woff2',
  'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjJTVPNI0.woff2',
  
  // Google Fonts - Inter (pour compatibilité)
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap',
  
  // Font files Inter (fallback)
  'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2JL7SUc.woff2',
  'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7SUc.woff2',
  'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2pL7SUc.woff2',
  'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7SUc.woff2',
  'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa0ZL7SUc.woff2',
  
  // Plus Jakarta Sans
  'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yygg_w.woff2',
  'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko40yygg_w.woff2',
  'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko50yygg_w.woff2',
  'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko30yygg_w.woff2',
  
  // SweetAlert2
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css',
  
  // html2pdf
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  
  // Lucide sprite et maps
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js.map',
  
  // html2pdf dependencies
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js.map'
];

// Toutes les ressources à mettre en cache pour une utilisation hors ligne
const ALL_RESOURCES = [...APP_SHELL, ...CDN_RESOURCES];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // On essaie de mettre en cache toutes les ressources
      // En cas d'échec pour certaines, on continue pour ne pas bloquer l'installation
      const promises = ALL_RESOURCES.map((url) => {
        return cache.add(url).catch((error) => {
          // Ignorer les erreurs pour les ressources qui ne peuvent pas être mises en cache
          console.log('⚠️ Impossible de mettre en cache:', url, error);
        });
      });
      return Promise.allSettled(promises);
    })
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

// Stratégie de mise en cache intelligente avec fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;
  
  // Ignorer les requêtes vers les APIs analytics ou tracking
  const url = new URL(request.url);
  if (url.hostname.includes('google-analytics') || 
      url.hostname.includes('googletagmanager')) return;

  // Pour les requêtes vers les images et polices, on utilise une stratégie différente
  const isImage = request.destination === 'image' || 
                  request.destination === 'font' ||
                  url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot)$/i);
  
  const isSameOrigin = url.origin === self.location.origin;
  const isCDN = CDN_RESOURCES.some(cdnUrl => request.url.includes(cdnUrl.substring(0, 30)));

  // Pour les requêtes CSS de Google Fonts, on intercepte spécifiquement
  const isGoogleFontsCSS = request.url.includes('fonts.googleapis.com/css');
  const isGoogleFontsFont = request.url.includes('fonts.gstatic.com');

  event.respondWith(
    caches.match(request).then((cached) => {
      // Si on a une réponse en cache et que c'est une ressource statique
      if (cached && (isImage || isCDN || isGoogleFontsCSS || isGoogleFontsFont)) {
        // Mise à jour en arrière-plan pour les ressources statiques
        fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
          })
          .catch(() => {});
        return cached;
      }

      // Pour les autres ressources, stratégie stale-while-revalidate
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              // On met en cache seulement si c'est une ressource importante
              if (isSameOrigin || isCDN || isImage || isGoogleFontsCSS || isGoogleFontsFont) {
                cache.put(request, clone);
              }
            });
          }
          return response;
        })
        .catch((error) => {
          // En cas d'erreur réseau, on retourne la version en cache si disponible
          if (cached) return cached;
          
          // Si c'est une requête de police Google Fonts, on retourne une police de fallback
          if (isGoogleFontsCSS || isGoogleFontsFont) {
            // On essaie de retourner une police système en fallback
            return new Response('', {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'text/css',
                'Cache-Control': 'public, max-age=31536000'
              }
            });
          }
          
          // Sinon, on essaie de retourner une page d'erreur
          if (request.destination === 'document') {
            return caches.match('/index.html').catch(() => {
              return new Response('Page non disponible hors ligne', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
          }
          throw error;
        });

      return cached || networkPromise;
    })
  );
});

// Préchargement des ressources essentielles lors du premier chargement
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  } else if (event.data === 'preload') {
    // Préchargement des ressources CDN en arrière-plan
    caches.open(CACHE_VERSION).then((cache) => {
      CDN_RESOURCES.forEach((url) => {
        fetch(url, { mode: 'no-cors' })
          .then((response) => {
            if (response && response.ok) {
              cache.put(url, response);
            }
          })
          .catch(() => {});
      });
    });
  }
});

// Gestion des notifications push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Nouvelle mise à jour disponible',
    icon: '/images/icone.png',
    badge: '/images/icone.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('📄 Le Facturier', options)
  );
});

// Gestion du clic sur notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
