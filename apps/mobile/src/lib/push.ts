import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

/**
 * Native push registration (FCM on Android).
 *
 * Web Push (PWA) stays the browser path; this is the native path. Token
 * delivery to the server is wired in Fase 3 of docs/ANDROID_ROADMAP.md —
 * for now the token is surfaced to the caller so it can be stored/sent.
 */

export type PushHandlers = {
  onToken: (token: string) => void;
  onNotificationTap: (url: string | null) => void;
};

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
