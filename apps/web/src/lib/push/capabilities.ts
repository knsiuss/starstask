/**
 * Browser capability detection for Web Push.
 *
 * Everything here is a pure function of its inputs so the same logic can be
 * unit tested in Node, where `window` and `Notification` do not exist.
 */

export type PushEnvironment = {
  isSecureContext: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIOS: boolean;
  isStandalone: boolean;
};

export type PushSupportStatus =
  | "supported"
  | "ios_needs_install"
  | "insecure_context"
  | "unsupported_browser";

export type PushSupportCopy = {
  status: PushSupportStatus;
  title: string;
  description: string;
  canEnable: boolean;
};

/**
 * iPadOS 13+ reports a desktop Safari user agent. Touch support is the
 * reliable signal that separates an iPad from a Mac.
 */
export function detectIOS(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    return true;
  }

  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function getPushSupportStatus(
  environment: PushEnvironment,
): PushSupportStatus {
  if (!environment.isSecureContext) {
    return "insecure_context";
  }

  // Checked before the API probe: iOS Safari in a normal tab has no
  // PushManager, so reporting "unsupported browser" there would be wrong.
  if (environment.isIOS && !environment.isStandalone) {
    return "ios_needs_install";
  }

  if (
    !environment.hasServiceWorker ||
    !environment.hasPushManager ||
    !environment.hasNotification
  ) {
    return "unsupported_browser";
  }

  return "supported";
}

export function describePushSupport(
  status: PushSupportStatus,
): PushSupportCopy {
  switch (status) {
    case "supported":
      return {
        status,
        title: "This browser can receive notifications",
        description:
          "Turn them on to get a reminder before your saved deadlines. You can turn them off again at any time.",
        canEnable: true,
      };
    case "ios_needs_install":
      return {
        status,
        title: "Add StarsTask to your Home Screen first",
        description:
          "On iPhone and iPad, Safari only allows notifications for web apps installed on the Home Screen. Follow the steps below, then open StarsTask from its icon.",
        canEnable: false,
      };
    case "insecure_context":
      return {
        status,
        title: "Notifications need a secure connection",
        description:
          "Open StarsTask over HTTPS. Browsers disable Web Push on plain HTTP except on localhost.",
        canEnable: false,
      };
    case "unsupported_browser":
      return {
        status,
        title: "This browser does not support Web Push",
        description:
          "Try a recent version of Chrome, Edge, Firefox, or Safari. Some in-app browsers and private modes block notifications entirely.",
        canEnable: false,
      };
  }
}

/** Reads the real environment. Client-only; returns null during SSR. */
export function readPushEnvironment(): PushEnvironment | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  return {
    isSecureContext: window.isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
    isIOS: detectIOS(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    isStandalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}

export type NotificationPermissionState =
  "default" | "granted" | "denied" | "unsupported";

export function readNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

/**
 * Converts the URL-safe base64 VAPID key into the byte array that
 * `pushManager.subscribe` expects.
 */
export function urlBase64ToUint8Array(
  base64Url: string,
): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes;
}
