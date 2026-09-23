/*
 * Front-desk service worker: keeps the app shell available when the line drops.
 *  - /_next/static and fonts: cache first (immutable, content-hashed)
 *  - page navigations: network first, fall back to the cached page, then /offline.html
 *  - RSC payloads (client-side navigations): network first, own cache
 *  - API calls are not touched here; data is cached in IndexedDB by the app and
 *    offline writes go through the IndexedDB outbox with Idempotency-Keys.
 */
const VERSION = "desk-v2";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
// React Server Component payloads live in their own cache so a page
// navigation can never be answered with one (they share URLs with pages).
const RSC = `${VERSION}-rsc`;
const PRECACHE = ["/today", "/ledger", "/reservations", "/login", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (url.hostname === "fonts.gstatic.com" || url.pathname.startsWith("/_next/static/media/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (req.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(req));
    return;
  }
  // client-side navigations fetch React Server Component payloads
  if (url.origin === self.location.origin && (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc"))) {
    event.respondWith(networkFirstRsc(req));
  }
});

async function networkFirstRsc(req) {
  const cache = await caches.open(RSC);
  const url = new URL(req.url);
  const key = new Request(`${url.origin}${url.pathname}`);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key)) || Response.error();
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirstPage(req) {
  const cache = await caches.open(SHELL);
  const url = new URL(req.url);
  const key = new Request(`${url.origin}${url.pathname}`);
  try {
    const res = await fetch(req);
    // only ever keep real HTML documents as pages
    if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) cache.put(key, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(key)) ||
      (await cache.match("/offline.html")) ||
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}
