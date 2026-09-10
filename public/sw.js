// Service worker for the installable shell only.
//
// This intentionally does NOT do offline caching of pages, API responses or
// any business data — offline working is explicitly out of scope for this
// project. Its only job is to precache the static shell assets (icons,
// manifest) that make the installed app feel instant, and it only ever
// answers from cache for requests it precached itself. Every other request
// — every page navigation, every /api call, every Server Action — is left
// alone and always goes to the network.
const CACHE_NAME = "santevie-shell-v1";
const SHELL_ASSETS = ["/manifest.webmanifest", "/icon", "/apple-icon", "/icons/192", "/icons/512"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept anything but a same-origin GET for a precached shell
  // asset — API routes, Server Actions and page navigations must always
  // hit the network so users never see stale or another user's data.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  const path = new URL(request.url).pathname;
  if (!SHELL_ASSETS.includes(path)) {
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
