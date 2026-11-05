import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Native push registration (FCM on Android).
 *
 * After registration the token is sent to the web API
 * (`POST /api/push/native-token`) so the server schedulers can fan out
 * reminder/event pushes to FCM devices as well as WebPush browsers.
 */

export type PushHandlers = {
  onToken: (token: string) => void;
  onNotificationTap: (url: string | null) => void;
};

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ??
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
        platform: Platform.OS === "ios" ? "ios" : "android",
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
  const permission = await Notifications.requestPermissionsAsync();

  if (permission.status !== "granted") {
    return false;
  }

  // The server sends with this channel id; it must exist before the first
  // native notification arrives or Android drops it silently.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("starstask-reminders", {
      name: "Reminders",
      description: "Assignment and session reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => undefined);
  }

  Notifications.addNotificationReceivedListener(() => undefined);
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const url = response.notification.request.content.data?.url;
      handlers.onNotificationTap(typeof url === "string" ? url : null);
    },
  );

  const tokenResponse = await Notifications.getDevicePushTokenAsync();

  if (tokenResponse.type === "android" || tokenResponse.type === "ios") {
    handlers.onToken(tokenResponse.data);
  }

  return true;
}
