/**
 * StarsTask service worker.
 *
 * Deliberately has no `fetch` handler: nothing is cached, so authenticated
 * pages and API responses can never be served from a stale or shared cache.
 * Its only jobs are showing push reminders and opening the right assignment.
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

self.addEventListener("install", () => {
  // A new worker takes over immediately; there is no cached shell to migrate.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(showReminder(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openAssignment(event.notification));
});

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
