// F6AD service worker — makes the app load + run offline (pairs with Firestore's
// own offline cache for data). Bump VERSION to force a fresh cache after changes.
var VERSION = 'f6ad-2026-06-21a';
var SHELL = [
  '/', '/soccer-fun-time.html', '/styles.css', '/manifest.json',
  '/js/01-core.js', '/js/02-auth.js', '/js/03-conditioning.js', '/js/04-sessions.js',
  '/js/05-voting.js', '/js/06-admin.js', '/js/08-init.js',
  '/js/gametracker/gt-core.js', '/js/gametracker/gt-shell.js', '/js/gametracker/gt-roster.js',
  '/js/gametracker/gt-game.js', '/js/gametracker/gt-review.js', '/js/gametracker/gt-tournaments.js',
  '/js/gametracker/gt-seasons.js',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon-180.png'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function(c) { return c.addAll(SHELL).catch(function(){}); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { if (k !== VERSION) return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var host = url.hostname;

  // Never intercept Firestore / Auth API traffic — the Firebase SDK manages its
  // own offline cache (IndexedDB) and request queue.
  if (host === 'firestore.googleapis.com' || host === 'firebaseinstallations.googleapis.com' ||
      host === 'identitytoolkit.googleapis.com' || host === 'securetoken.googleapis.com' ||
      host.indexOf('firebaseio.com') >= 0) {
    return;
  }

  // Cross-origin static libraries (Firebase SDK on gstatic, jsPDF on cloudflare,
  // Google Fonts): cache-first so they're available offline after one online load.
  if (host !== self.location.hostname) {
    e.respondWith(
      caches.match(req).then(function(hit) {
        return hit || fetch(req).then(function(res) {
          if (res && res.status === 200) { var cl = res.clone(); caches.open(VERSION).then(function(c){ c.put(req, cl); }); }
          return res;
        }).catch(function(){ return hit; });
      })
    );
    return;
  }

  // Same-origin app files: network-first (always fresh when online), fall back to
  // cache when offline. SPA navigations fall back to the cached app shell.
  e.respondWith(
    fetch(req).then(function(res) {
      if (res && res.status === 200) { var cl = res.clone(); caches.open(VERSION).then(function(c){ c.put(req, cl); }); }
      return res;
    }).catch(function() {
      return caches.match(req).then(function(hit) {
        return hit || (req.mode === 'navigate' ? caches.match('/soccer-fun-time.html') : Response.error());
      });
    })
  );
});
