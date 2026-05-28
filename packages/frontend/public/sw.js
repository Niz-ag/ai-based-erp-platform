const CACHE_NAME = 'amdox-erp-cache-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    })
  );
});

// AI MANDATE: Safe Mode
// We are disabling fetch interception to eliminate all "Failed to fetch" 
// and "Response" conversion errors while debugging core auth flows.
self.addEventListener('fetch', (event) => {
  return; 
});
