const CACHE_NAME = 'amana-diagnostics-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/manifest.json',
  '/uss-pics/N SCAN PELVIC.jpeg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 0. Only intercept http and https schemes (filters out chrome-extension, chrome, data, etc.)
  if (!event.request.url.startsWith('http')) {
    return;
  }
  const url = new URL(event.request.url);

  // 1. NEVER cache API requests or database routes - go straight to network
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/_next/data/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. For page routes and static assets, use Network-First, falling back to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If we got a valid response, clone and cache it for static assets
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Do not cache hot reload files or temporary webpack assets
            if (!url.pathname.includes('/_next/static/webpack/')) {
              cache.put(event.request, responseToCache);
            }
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If offline and request is for a page, return the cached root '/'
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
