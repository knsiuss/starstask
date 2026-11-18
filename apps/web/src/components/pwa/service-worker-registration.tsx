"use client";

import { useEffect } from "react";

import { OfflineOutboxProvider } from "@/components/pwa/offline-outbox-provider";
import { registerServiceWorker } from "@/lib/push/service-worker";

/**
 * Registers the push-only service worker once per page load and mounts the
 * offline outbox provider next to it (same app-root slot; root layout
 * unchanged).
 *
 * Renders nothing else and swallows failures: browsers without service worker
 * support (or with it disabled) still get the complete website.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return <OfflineOutboxProvider />;
}
