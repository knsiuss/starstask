"use client";

import { useEffect } from "react";

import { registerServiceWorker } from "@/lib/push/service-worker";

/**
 * Registers the push-only service worker once per page load.
 *
 * Renders nothing and swallows failures: browsers without service worker
 * support (or with it disabled) still get the complete website.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return null;
}
