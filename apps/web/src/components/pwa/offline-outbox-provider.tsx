"use client";

import { useEffect, useState } from "react";

import { OutboxPendingBadge } from "@/components/attendance/outbox-pending-badge";
import {
  clearAll,
  count,
  flush,
  subscribe,
} from "@/lib/offline/checkin-outbox";

const FLUSH_INTERVAL_MS = 30_000;

type OutboxState = {
  count: number;
  sessionExpired: boolean;
};

const INITIAL_STATE: OutboxState = { count: 0, sessionExpired: false };

/**
 * Best-effort Background Sync is Chromium-only. Safari/iOS has no
 * `registration.sync`; the guaranteed flush paths are the `online` event, the
 * foreground 30s interval, reconcile-on-mount, and visibilitychange below.
 * The UI must never claim delivery — it only attempts sync while the app is
 * open.
 */
async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    if (!("sync" in registration)) {
      return;
    }

    // `sync` is absent from lib.dom in TS 5.9; narrow via a structural cast.
    const syncManager = (
      registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;

    if (!syncManager) {
      return;
    }

    await syncManager.register("checkin-outbox");
  } catch {
    // Chromium-only API; Safari/iOS throws or lacks it. Silent by design.
  }
}

/**
 * App-wide provider for the offline check-in outbox. Flushes on mount, on
 * reconnect, on tab return, and on a 30s foreground interval, exposes the
 * pending count to the badge, and routes SW messages to the right code path.
 * The actual IndexedDB wipe for CLEAR_OFFLINE_STORAGE lives here (the page is
 * the only place that can touch the stores with the user present); the SW
 * never performs fetches itself.
 */
export function OfflineOutboxProvider() {
  const [state, setState] = useState<OutboxState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    let previousPendingCount = 0;

    const unsubscribe = subscribe((entries) => {
      const pendingCount = entries.filter(
        (entry) => entry.status === "pending_sync",
      ).length;

      const enqueuedMore = pendingCount > previousPendingCount;

      previousPendingCount = pendingCount;

      setState((previous) =>
        previous.count === pendingCount
          ? previous
          : { ...previous, count: pendingCount },
      );

      // A fresh tap is the moment Background Sync can help; retry requests go
      // through the same path (Chromium-only, silently skipped elsewhere).
      if (enqueuedMore) {
        void requestBackgroundSync();
      }
    });

    // flush() notifies subscribers itself; this seeds the badge for entries
    // that were pending before the app opened.
    count()
      .then((nextCount) => {
        if (cancelled) {
          return;
        }

        previousPendingCount = nextCount;
        setState((previous) =>
          previous.count === nextCount
            ? previous
            : { ...previous, count: nextCount },
        );
      })
      .catch(() => {
        // IndexedDB unavailable: leave the badge hidden.
      });

    const runFlush = async () => {
      try {
        const result = await flush();

        // After any flush, ask for Background Sync once so a future reconnect
        // can wake us (Chromium only; iOS/Safari silently skips).
        void requestBackgroundSync();

        if (cancelled) {
          return;
        }

        setState((previous) => ({
          ...previous,
          sessionExpired: result.sessionExpired,
        }));
      } catch (error) {
        console.error("[offline] outbox flush failed", {
          name: error instanceof Error ? error.name : "unknown",
        });
      }
    };

    const handleOnline = () => {
      // runFlush() already registers Background Sync afterwards.
      void runFlush();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runFlush();
      }
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const data: unknown = event.data;

      if (!data || typeof data !== "object") {
        return;
      }

      const type = (data as { type?: unknown }).type;

      if (type === "FLUSH_OUTBOX") {
        void runFlush();
        return;
      }

      if (type === "CLEAR_OFFLINE_STORAGE") {
        clearAll().catch((error: unknown) => {
          console.error("[offline] failed to wipe outbox", {
            name: error instanceof Error ? error.name : "unknown",
          });
        });
      }
    };

    void runFlush();

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Foreground-only interval. iOS/Safari has no Background Sync, so the app
    // must poll while it is open; the interval dies with the tab.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runFlush();
      }
    }, FLUSH_INTERVAL_MS);

    if (
      "serviceWorker" in navigator &&
      navigator.serviceWorker &&
      typeof navigator.serviceWorker.addEventListener === "function"
    ) {
      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage,
      );
    }

    return () => {
      cancelled = true;

      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);

      if (
        "serviceWorker" in navigator &&
        navigator.serviceWorker &&
        typeof navigator.serviceWorker.removeEventListener === "function"
      ) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleServiceWorkerMessage,
        );
      }

      unsubscribe();
    };
  }, []);

  return (
    <OutboxPendingBadge
      count={state.count}
      sessionExpired={state.sessionExpired}
    />
  );
}
