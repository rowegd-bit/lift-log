// Lift Log service worker: serves the app from cache so it opens with no connection,
// and refreshes the cache in the background whenever the network is available.
const CACHE = "lift-log-v1";
const CORE = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png", "icon-maskable.png"];

self.addEventListener("install", e => {
  // Cache each file on its own so one missing file can't block offline support.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  // Stale-while-revalidate: answer from cache instantly, update it from the network.
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const lookup = req.mode === "navigate" ? "index.html" : req;
      const cached = await cache.match(lookup, { ignoreSearch: sameOrigin });
      const network = fetch(req)
        .then(res => {
          if (res && (res.ok || res.type === "opaque")) cache.put(lookup, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
