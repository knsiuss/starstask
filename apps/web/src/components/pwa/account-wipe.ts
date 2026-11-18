"use client";

import { clearAll } from "@/lib/offline/checkin-outbox";

// Mirror of the CACHE_NAME literal in public/sw.js. The worker owns cache
// deletion; this page-side delete only covers the window's CacheStorage,
// which shares the same namespace. Keep the two literals in sync by hand.
const OFFLINE_STATIC_CACHE = "starstask-offline-static-v1";

// `navigator.serviceWorker.ready` can stay unsettled forever when no worker
// ever activates (e.g. SW registration failed earlier). The sign-out path
// must not inherit that hang, so the ready lookup is raced against a budget.
const SW_READY_TIMEOUT_MS = 1000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function postClearMessage(): Promise<void> {
  if (typeof navigator === "undefined") {
    return;
  }

  if (!("serviceWorker" in navigator)) {
    return;
  }

  // A controlled page can message its controller directly with no async wait;
  // the postMessage itself is fire-and-forget from the page's perspective.
  const controller = navigator.serviceWorker.controller;

  if (controller) {
    controller.postMessage({ type: "CLEAR_OFFLINE_STORAGE" });
    return;
  }

  const registration = await withTimeout(
    navigator.serviceWorker.ready,
    SW_READY_TIMEOUT_MS,
  );

  const active = registration?.active ?? null;

  if (active) {
    active.postMessage({ type: "CLEAR_OFFLINE_STORAGE" });
  }
}

/**
 * Best-effort wipe of everything the offline check-in flow persisted on this
 * device: outbox + cached view (IndexedDB, via `clearAll`), the static
 * offline shell cache (CacheStorage), and — via the SW message — the worker's
 * own caches plus any other open tabs' IndexedDB.
 *
 * Never throws and never hangs indefinitely: callers are sign-out paths that
 * must navigate regardless. Each stage reports its own failure via
 * `console.error` and the rest still run.
 */
export async function wipeOfflineStorage(): Promise<void> {
  try {
    await postClearMessage();
  } catch (error) {
    console.error("[offline] failed to notify the service worker", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }

  try {
    await clearAll();
  } catch (error) {
    console.error("[offline] failed to wipe the outbox", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }

  try {
    if (typeof caches !== "undefined") {
      await caches.delete(OFFLINE_STATIC_CACHE);
    }
  } catch (error) {
    console.error("[offline] failed to delete the offline cache", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }
}
