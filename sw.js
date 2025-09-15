const CACHE_NAME = 'moti-cache-v1';
const CORE_ASSETS = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))).then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // fallback to core index for navigations
    if (request.mode === 'navigate') return caches.match('./index.html');
    throw e;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const accept = request.headers.get('accept') || '';

  // HTML navigation
  if (request.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Pexels images -> cache-first
  if (url.hostname.includes('pexels.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Quotes APIs -> network-first (then cache)
  if (url.hostname.includes('zenquotes.io') || url.hostname.includes('type.fit')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Other assets -> cache-first
  event.respondWith(cacheFirst(request));
});

