const CACHE_VERSION = 'gempar-v5';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/mascot.png',
  '/assets/slide1.jpg',
  '/assets/slide2.jpg',
  '/assets/slide3.jpg',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// ── INSTALL: Cache asset statis ──
self.addEventListener('install', (e) => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: Hapus cache lama ──
self.addEventListener('activate', (e) => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => !key.startsWith(CACHE_VERSION)).map(key => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// ── MESSAGE: Handle skipWaiting from page ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('[SW] Skip waiting triggered');
    self.skipWaiting();
  }
});

// Helper: normalize URL (remove query strings for cache matching)
function normalizeUrl(url) {
  const urlObj = new URL(url);
  return urlObj.pathname;
}

// ── FETCH: Network First + Cache Fallback ──
self.addEventListener('fetch', (e) => {
  const { request } = e;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  const normalizedUrl = normalizeUrl(request.url);

  // For HTML pages → always fetch from network first
  if (request.mode === 'navigate' || request.destination === 'document') {
    e.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          return res;
        })
        .catch(() => {
          console.log('[SW] Network failed, serving from cache:', normalizedUrl);
          return caches.match(request);
        })
    );
    return;
  }

  // For JS files → network first
  if (request.destination === 'script') {
    e.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For images and other assets → network first, fallback to cache
  e.respondWith(
    fetch(request)
      .then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') {
          return res;
        }
        const clone = res.clone();
        caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        return res;
      })
      .catch(() => {
        console.log('[SW] Network failed, serving from cache:', normalizedUrl);
        return caches.match(request);
      })
  );
});