const CACHE_NAME = 'jet-music-v7';

// Install event - Force immediate activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - Wipe all old caches instantly
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
    ])
  );
});

// Fetch event Optimized for Continuous Background Audio (v7)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Detect audio streams
  const isAudio = 
    url.pathname.includes('/api/stream') || 
    url.href.includes('.mp3') || 
    url.href.includes('.m4a') || 
    url.href.includes('opus') ||
    url.href.includes('googlevideo.com');

  if (isAudio) {
    event.respondWith(
      fetch(request, {
        priority: 'high',
        keepalive: true
      }).catch(err => {
        console.error("[SW] Background fetch failed:", err);
        return caches.match(request);
      })
    );
    return;
  }

  // Standard strategy: Network-first for main scripts, Cache-first for assets
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/') {
      event.respondWith(
        fetch(request).then(response => {
           const copy = response.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
           return response;
        }).catch(() => caches.match(request))
      );
      return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).then(networkResponse => {
         return networkResponse;
      });
    })
  );
});
