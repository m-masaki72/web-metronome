const CACHE_NAME = "metronome-cache-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/main.js",
  "./js/scheduler.js",
  "./js/sounds.js",
  "./js/tapTempo.js",
  "./js/haptics.js",
  "./js/wakeLock.js",
  "./js/quickSlots.js",
  "./js/visualBeat.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./sounds/click.wav",
  "./sounds/wood.wav",
  "./sounds/beep.wav",
  "./sounds/block.wav",
  "./sounds/bell.wav",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);
    })
  );
});
