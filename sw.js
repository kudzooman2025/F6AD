// F6AD service worker — DISABLED / self-removing.
// The caching service worker caused repeated load failures, so it has been
// neutralized. This version clears all caches, unregisters itself, and reloads
// open tabs so every device returns to plain, reliable network loading.
self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) { return Promise.all(keys.map(function(k){ return caches.delete(k); })); })
      .then(function() { return self.registration.unregister(); })
      .then(function() { return self.clients.matchAll({ type: 'window' }); })
      .then(function(clients) { clients.forEach(function(c){ try { c.navigate(c.url); } catch (e) {} }); })
  );
});
// No fetch handler — the browser handles all requests directly over the network.
