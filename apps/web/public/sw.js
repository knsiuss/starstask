/**
 * StarsTask service worker.
 *
 * Jobs:
 * - Show push reminders and open the requested assignment (unchanged).
 * - Keep the installed PWA usable without a network for the static shell:
 *   `/offline` and the app icons are precached at install; `/_next/static/*`
 *   and `/icons/*` are served cache-first (filename-hashed by Next, so stale
 *   entries are impossible); `/attendance` and `/attendance/checkin/*`
 *   navigations are network-first with the static `/offline` page as the
 *   last-resort fallback.
 * - Relay outbox signals: a `sync` event tagged `checkin-outbox` asks open
 *   window clients to flush the offline check-in outbox, and the message
 *   handlers implement `CLEAR_OFFLINE_STORAGE` (delete offline caches, tell
 *   open pages to wipe IndexedDB) and `FLUSH_OUTBOX` (fan out to open pages).
 *
 * What this worker never does:
 * - Cache authenticated or personalized HTML, RSC payloads, or API responses.
 *   No such cache exists by design, so a shared or stale cache can never leak
 *   one user's data to another (L4).
 * - Intercept non-GET requests, `/api/*`, `_next/data/*`, or `?_rsc=` payloads.
 * - Perform check-in fetches itself: the page owns them (session cookie
 *   reliability, one code path). The worker only relays flush signals.
 *
 * Background Sync (`registration.sync`) is not available in Safari/iOS; there,
 * flushing happens while the app is open (online listener, foreground
 * interval, reconcile-on-mount). No message or sync handler may promise
 * delivery.
 */

const ASSIGNMENT_PATH =
  /^\/assignments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_ASSIGNMENT_PATH =
  /^\/admin\/assignments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLASS_PATH =
  /^\/(?:dashboard\/)?classes\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/(?:assignments|attendance|courses|leave-requests|manage|members|overview|review|schedule|settings|submit))?$/;
const LEAVE_REQUEST_PATH =
  /^\/leave-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_PATH =
  /^\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGES_PATH =
  /^\/messages\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATIC_PATHS = [
  "/app",
  "/app/actions",
  "/app/lecturer",
  "/app/review",
  "/lecturer",
  "/actions",
  "/assignments",
  "/my-assignments",
  "/classes",
  "/university",
  "/schedule",
  "/sessions",
  "/attendance",
  "/leave-requests",
  "/notifications",
  "/messages",
  "/settings/calendar",
  "/settings/profile",
  "/settings/drive",
  "/settings/security",
  "/admin/verifications",
  "/dashboard",
  "/dashboard/review",
  "/dashboard/schedule",
  "/dashboard/sessions",
  "/dashboard/leave-requests",
];
const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/badge-96.png";
const FALLBACK_URL = "/";

const CACHE_PREFIX = "starstask-offline-";
const CACHE_NAME = "starstask-offline-static-v1";
const PRECACHE_URLS = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/badge-96.png",
];
const CHECKIN_OUTBOX_SYNC_TAG = "checkin-outbox";

self.addEventListener("install", (event) => {
  // A new worker takes over immediately; the precache is static and safe to
  // swap atomically.
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([self.clients.claim(), deleteOldOfflineCaches()]),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // The allowlist is closed on purpose: anything not matched below falls
  // through to a plain network fetch with no cache read or write.
  if (isBypassedPath(url)) {
    return;
  }

  if (isCacheableStaticAsset(url.pathname) || url.pathname === "/offline") {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isAttendanceNavigation(request, url.pathname)) {
    event.respondWith(attendanceNavigation(request));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag !== CHECKIN_OUTBOX_SYNC_TAG) {
    return;
  }

  // The worker never performs the replay fetch; it only wakes the pages.
  event.waitUntil(relayToWindowClients({ type: "FLUSH_OUTBOX" }));
});

self.addEventListener("message", (event) => {
  const data = event.data;

  if (!data || typeof data !== "object" || typeof data.type !== "string") {
    return;
  }

  if (data.type === "CLEAR_OFFLINE_STORAGE") {
    event.waitUntil(clearOfflineStorage());
    return;
  }

  if (data.type === "FLUSH_OUTBOX") {
    // Relay so every open tab flushes; pages own the actual network calls.
    event.waitUntil(relayToWindowClients({ type: "FLUSH_OUTBOX" }));
  }
});

self.addEventListener("push", (event) => {
  event.waitUntil(showReminder(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openAssignment(event.notification));
});

function isBypassedPath(url) {
  // RSC payloads and Next data routes ride on the page URL with a query flag;
  // they must never be served from a cache.
  if (url.searchParams.has("_rsc")) {
    return true;
  }

  const { pathname } = url;

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return true;
  }

  if (pathname.startsWith("/_next/data/")) {
    return true;
  }

  return false;
}

function isCacheableStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/")
  );
}

function isAttendanceNavigation(request, pathname) {
  if (request.mode !== "navigate") {
    return false;
  }

  if (pathname === "/attendance") {
    return true;
  }

  return pathname.startsWith("/attendance/checkin/");
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);

    try {
      await cache.put(request, response.clone());
    } catch {
      // Quota or clone failures must not break serving the network response.
    }
  }

  return response;
}

async function attendanceNavigation(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Last resort for the static shell only; never a cached page with user data.
    const fallback = await caches.match("/offline");

    if (fallback) {
      return fallback;
    }

    throw error;
  }
}

async function deleteOldOfflineCaches() {
  const keys = await caches.keys();
  const stale = keys.filter(
    (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
  );

  await Promise.all(stale.map((key) => caches.delete(key)));
}

async function clearOfflineStorage() {
  const keys = await caches.keys();
  const offlineKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));

  await Promise.all(offlineKeys.map((key) => caches.delete(key)));

  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of windows) {
    client.postMessage({ type: "CLEAR_OFFLINE_STORAGE" });
  }
}

async function relayToWindowClients(message) {
  const windows = await self.clients.matchAll({ type: "window" });

  for (const client of windows) {
    client.postMessage(message);
  }
}

async function showReminder(event) {
  const payload = readPayload(event);

  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    // The tag is derived from assignment + reminder type + deadline, so a
    // redelivered push replaces the previous notification instead of stacking.
    tag: payload.tag,
    renotify: false,
    data: { url: payload.url },
    timestamp: payload.timestamp,
  });
}

function readPayload(event) {
  let parsed = null;

  if (event.data) {
    try {
      parsed = event.data.json();
    } catch {
      parsed = null;
    }
  }

  const url =
    typeof parsed?.url === "string" && isSafePath(parsed.url)
      ? parsed.url
      : FALLBACK_URL;

  return {
    title: text(parsed?.title, "StarsTask", 120),
    body: text(parsed?.body, "You have an upcoming assignment deadline.", 240),
    icon: text(parsed?.icon, DEFAULT_ICON, 200),
    badge: text(parsed?.badge, DEFAULT_BADGE, 200),
    tag: text(parsed?.tag, "starstask-reminder", 120),
    timestamp: Number.isFinite(parsed?.timestamp)
      ? parsed.timestamp
      : Date.now(),
    url,
  };
}

/** Mirrors `isSafeNotificationPath` on the server; a payload is untrusted here. */
function isSafePath(value) {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    (STATIC_PATHS.includes(value) ||
      CLASS_PATH.test(value) ||
      LEAVE_REQUEST_PATH.test(value) ||
      ASSIGNMENT_PATH.test(value) ||
      ADMIN_ASSIGNMENT_PATH.test(value) ||
      SESSION_PATH.test(value) ||
      MESSAGES_PATH.test(value))
  );
}

function text(value, fallback, maxLength) {
  return typeof value === "string" && value.trim()
    ? value.slice(0, maxLength)
    : fallback;
}

async function openAssignment(notification) {
  const url = new URL(
    isSafePath(notification.data?.url) ? notification.data.url : FALLBACK_URL,
    self.location.origin,
  ).href;

  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of windows) {
    if (new URL(client.url).origin !== self.location.origin) {
      continue;
    }

    await client.navigate(url);
    return client.focus();
  }

  return self.clients.openWindow(url);
}
