// Service Worker - يعمل في الخلفية لتخزين الملفات
const CACHE_NAME = 'ai-chat-v1';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  // لا تخزّن طلبات API أو Supabase
  const url = e.request.url;
  if (url.includes('/api/') || url.includes('supabase.co') || url.includes('notrack.ai')) return;
  
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});