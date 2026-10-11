// ═══════════════════════════════════════════════════════
// SERVICE WORKER — استراتيجية caching محسّنة + تحديثات فورية
// ═══════════════════════════════════════════════════════

const VERSION = 'v6.4.1';
const CACHE_STATIC = `ai-chat-static-${VERSION}`;
const CACHE_RUNTIME = `ai-chat-runtime-${VERSION}`;

// ملفات أساسية تُخزَّن فورًا عند التثبيت
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/app.js',
  '/js/enhancements.js',
  '/js/syntax.js',
  '/js/cursor.js',
  '/js/icons.js',
  '/js/particles.js',
  '/js/pwa.js',
  '/manifest.json',
];

// ═══════ Install ═══════
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_STATIC).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

// ═══════ Activate — احذف الـ caches القديمة ═══════
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ═══════ Push Event ═══════
self.addEventListener('push', (e) => {
  let data = { title: '🏮 مِشكاة', body: 'لديك إشعار جديد' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
      tag: 'mishkat-' + Date.now(),
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// ═══════ Message — اسمح للصفحة بتفعيل skipWaiting ═══════
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ═══════ Fetch ═══════
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // تجاهل: طلبات API، Supabase، notrack، طرق غير GET
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('supabase')) return;
  if (url.hostname.includes('notrack')) return;
  if (url.protocol === 'chrome-extension:') return;

  // HTML — Network First (احصل على آخر نسخة، وإلا cache)
  if (req.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(networkFirst(req, CACHE_STATIC));
    return;
  }

  // ملفات ثابتة من نفس النطاق — Cache First
  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirst(req, CACHE_STATIC));
    return;
  }

  // CDN / خطوط / أيقونات خارجية — Stale While Revalidate
  e.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME));
});

// ═══════ Strategies ═══════
async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Fallback: أعطِ index.html للتنقل
    const fallback = await caches.match('/index.html');
    if (fallback) return fallback;
    return new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(res => {
    if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return cached || await fetchPromise || new Response('Offline', { status: 503 });
}