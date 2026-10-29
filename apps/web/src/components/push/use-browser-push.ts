"use client";

import * as React from "react";

import {
  readNotificationPermission,
  readPushEnvironment,
  type NotificationPermissionState,
  type PushEnvironment,
} from "@/lib/push/capabilities";

/**
 * Browser-only push state read through `useSyncExternalStore`.
 *
 * Reading `window` during render would break SSR, and copying it into state
 * from an effect causes an extra cascading render. The external-store API gives
 * React a server snapshot for hydration and the real snapshot afterwards.
 */

let cachedEnvironment: PushEnvironment | null | undefined;

function getEnvironmentSnapshot(): PushEnvironment | null {
  if (cachedEnvironment === undefined) {
    cachedEnvironment = readPushEnvironment();
  }

  return cachedEnvironment;
}

/** Hydration must match the server, which has no browser APIs. */
function getServerEnvironmentSnapshot(): PushEnvironment | null {
  return null;
}

function subscribeToEnvironment(): () => void {
  // The environment does not change while the page is open.
  return () => undefined;
}

const permissionListeners = new Set<() => void>();

function subscribeToPermission(listener: () => void): () => void {
  permissionListeners.add(listener);

  return () => {
    permissionListeners.delete(listener);
  };
}

/** Re-reads `Notification.permission` after a prompt resolves. */
export function notifyPermissionChanged(): void {
  for (const listener of permissionListeners) {
    listener();
  }
}

export function usePushEnvironment(): PushEnvironment | null {
  return React.useSyncExternalStore(
    subscribeToEnvironment,
    getEnvironmentSnapshot,
    getServerEnvironmentSnapshot,
  );
}

export function useNotificationPermission(): NotificationPermissionState {
  return React.useSyncExternalStore(
    subscribeToPermission,
    readNotificationPermission,
    () => "default" as const,
  );
}
