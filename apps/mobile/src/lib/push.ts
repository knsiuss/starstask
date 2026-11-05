import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

/**
 * Native push registration (FCM on Android).
 *
 * Web Push (PWA) stays the browser path; this is the native path. After
 * registration the token is sent to the web API
 * (`POST /api/push/native-token`) so the server schedulers can fan out
 * reminder/event pushes to FCM devices as well as WebPush browsers.
 */

export type PushHandlers = {
  onToken: (token: string) => void;
  onNotificationTap: (url: string | null) => void;
};

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://starstask.vercel.app";

/** Opens a notification target inside the app's own WebView. */
export async function openNotificationTarget(url: string): Promise<void> {
  const absolute = url.startsWith("http")
    ? url
    : `${API_BASE_URL.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;

  window.location.assign(absolute);
}

/** Registers an FCM token with the web API; best effort, never throws. */
export async function sendNativeTokenToServer(
  token: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/push/native-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token,
        platform: Capacitor.getPlatform() === "ios" ? "ios" : "android",
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function registerNativePush(
  handlers: PushHandlers,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const permission = await PushNotifications.requestPermissions();

  if (permission.receive !== "granted") {
    return false;
  }

  // The server sends with this channel id; it must exist before the first
  // native notification arrives or Android drops it silently.
  await PushNotifications.createChannel({
    id: "starstask-reminders",
    name: "Reminders",
    description: "Assignment and session reminders",
    importance: 5,
    visibility: 1,
  }).catch(() => undefined);

  await PushNotifications.addListener("registration", (token) => {
    handlers.onToken(token.value);
  });

  await PushNotifications.addListener("registrationError", (error) => {
    console.error("[push] registration error", error);
  });

  await PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      const url = action.notification.data?.url;
      handlers.onNotificationTap(typeof url === "string" ? url : null);
    },
  );

  await PushNotifications.register();

  return true;
}
