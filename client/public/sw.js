const CACHE_NAME = 'lyricsync-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service worker installed');
        return cache.add('/');
      })
      .catch((error) => {
        console.log('Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }

            if (response.type !== 'basic' && response.type !== 'cors') {
              return response;
            }

            const shouldCache = 
              url.pathname.match(/\.(js|ts|tsx|css|png|jpg|jpeg|svg|woff|woff2)$/) || 
              url.pathname.startsWith('/src/') ||
              url.pathname.startsWith('/assets/') ||
              url.pathname.startsWith('/@vite/') ||
              url.pathname.startsWith('/@react-refresh') ||
              url.pathname.startsWith('/@fs/') ||
              url.pathname.startsWith('/node_modules/');
            
            if (shouldCache) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }

            return response;
          })
          .catch(() => {
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
            
            return new Response('Offline - Please check your internet connection', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
