// Service Worker — منصة الدكتور علي سعد v2
// يخزن الملفات الثابتة ويعمل بشكل أسرع بدون اتصال

const CACHE_NAME = "dr-ali-static-v2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./exam-enhancements.js",
  "./manifest.json",
  "./icon.svg",
  "./icon-maskable.svg",
  "./favicon.ico"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;
  if (url.hostname.includes("firebaseio.com")) return;
  if (url.hostname.includes("firebasedatabase.app")) return;
  if (url.hostname.includes("googleapis.com")) return;
  if (url.hostname.includes("gstatic.com")) return;
  if (url.hostname.includes("cdnjs.cloudflare.com")) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const networkFetch = fetch(req).then(response => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});

// رسالة لتحديث الكاش يدوياً
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
