/* File Viewer service worker: lets the page, the file index and files you have opened work without a connection.
   Everything is network-first: when the network answers (within 4 s) you get the fresh copy and it is saved;
   when it is slow, blocked or offline, the last saved copy is shown instead and refreshed in the background.
   Only same-origin GET requests are handled. Streams, ranges (audio/video seeking) and other sites are left alone. */
const VERSION = "fv-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png"];
const MAX_ENTRIES = 400;          // saved files beyond the shell, oldest removed first
const MAX_BYTES = 6 * 1024 * 1024; // larger responses are not saved
const WAIT_MS = 4000;             // how long to wait for the network before showing the saved copy

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())
    );
});
self.addEventListener("activate", (e) => {
    e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => {
    if (e.data === "clear") e.waitUntil(caches.delete(VERSION).then(() => caches.open(VERSION)));
});

function cacheable(res) {
    if (!res || !res.ok || res.status !== 200 || res.type === "opaque") return false;
    const len = parseInt(res.headers.get("content-length") || "0", 10);
    if (len > MAX_BYTES) return false;
    const type = res.headers.get("content-type") || "";
    return !/^(audio|video)\//i.test(type);
}
async function trim(cache) {
    const keys = await cache.keys();
    const extra = keys.length - MAX_ENTRIES;
    if (extra <= 0) return;
    let n = 0;
    for (const k of keys) {
        if (n >= extra + 40) break;
        const path = new URL(k.url).pathname;
        if (/\/(index\.html|manifest\.webmanifest|file_index(_lean)?\.json)?$/.test(path)) continue; // keep the shell and the indexes
        await cache.delete(k);
        n++;
    }
}
function networkFirst(evt, req) {
    return caches.open(VERSION).then(async (cache) => {
        const netP = fetch(req).then((res) => {
            if (cacheable(res)) evt.waitUntil(cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {}));
            return res;
        });
        const cached = (await cache.match(req)) || (req.mode === "navigate" ? await cache.match("./index.html") : undefined);
        if (!cached) return netP;
        evt.waitUntil(netP.catch(() => {})); // keep refreshing the saved copy after a slow answer
        return Promise.race([netP.catch(() => cached), new Promise((r) => setTimeout(() => r(cached), WAIT_MS))]);
    });
}
self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET" || req.headers.has("range")) return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    e.respondWith(networkFirst(e, req));
});
