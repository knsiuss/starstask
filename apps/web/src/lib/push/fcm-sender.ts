import "server-only";

import { cert, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

import type { ReminderPayload } from "@/lib/push/payload";
import type { PushSendOutcome } from "@/lib/push/sender";

/**
 * Native (FCM) push sender for the Capacitor mobile shell.
 *
 * Mirrors the WebPush PushSender contract so the schedulers can fan out to
 * both channels with the same outcome accounting. Without Firebase service
 * account credentials nothing is sent — callers pass `null` and the native
 * channel is simply skipped, WebPush keeps working.
 */

export type NativePushTarget = {
  id: string;
  userId: string;
  token: string;
};

export interface NativePushSender {
  send(
    target: NativePushTarget,
    payload: ReminderPayload,
  ): Promise<PushSendOutcome>;
}

export type FcmConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

const FCM_TIMEOUT_MS = 10_000;

/** Android notification channel id, created by the mobile shell on launch. */
export const NATIVE_CHANNEL_ID = "starstask-reminders";

function parseServiceAccount(raw: string): FcmConfig | null {
  try {
    const parsed = JSON.parse(raw) as {
      project_id?: unknown;
      client_email?: unknown;
      private_key?: unknown;
    };

    if (
      typeof parsed.project_id !== "string" ||
      typeof parsed.client_email !== "string" ||
      typeof parsed.private_key !== "string"
    ) {
      return null;
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  } catch {
    return null;
  }
}

/** Firebase is configured only when a service account JSON is provided. */
export function getFcmConfig(): FcmConfig | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  return raw ? parseServiceAccount(raw) : null;
}

let app: App | null = null;

function getMessagingApp(config: FcmConfig): App {
  if (!app) {
    app = initializeApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
    });
  }

  return app;
}

function classifyFcmError(error: unknown): PushSendOutcome {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  // Dead tokens must be disabled so they are not retried forever.
  if (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-request"
  ) {
    return {
      ok: false,
      category: "expired",
      statusCode: null,
      retryable: false,
      disableSubscription: true,
    };
  }

  if (code === "messaging/third-party-auth-error") {
    return {
      ok: false,
      category: "unauthorized",
      statusCode: null,
      retryable: true,
      disableSubscription: false,
    };
  }

  return {
    ok: false,
    category: "transient",
    statusCode: null,
    retryable: true,
    disableSubscription: false,
  };
}

export function createFcmSender(config: FcmConfig): NativePushSender {
  const messaging = getMessaging(getMessagingApp(config));

  return {
    async send(target, payload) {
      try {
        const messageId = await Promise.race([
          messaging.send({
            token: target.token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: {
              url: payload.url,
              tag: payload.tag,
            },
            android: {
              priority: "high",
              notification: {
                channelId: NATIVE_CHANNEL_ID,
                tag: payload.tag,
              },
            },
          }),
          new Promise<never>((_resolve, reject) => {
            setTimeout(
              () => reject(new Error("FCM send timed out")),
              FCM_TIMEOUT_MS,
            );
          }),
        ]);

        return { ok: true, statusCode: 200 };
      } catch (error) {
        return classifyFcmError(error);
      }
    },
  };
}

/** Returns `null` when Firebase is not configured; WebPush is unaffected. */
export function createNativeSenderFromEnv(): NativePushSender | null {
  const config = getFcmConfig();

  return config ? createFcmSender(config) : null;
}

/** Sends and converts a thrown sender into a transient failure. */
export async function sendNativeSafely(
  sender: NativePushSender,
  target: NativePushTarget,
  payload: ReminderPayload,
): Promise<PushSendOutcome> {
  try {
    return await sender.send(target, payload);
  } catch {
    return {
      ok: false,
      category: "transient",
      statusCode: null,
      retryable: true,
      disableSubscription: false,
    };
  }
}

export function groupNativeTokensByUser(
  tokens: NativePushTarget[],
): Map<string, NativePushTarget[]> {
  const grouped = new Map<string, NativePushTarget[]>();

  for (const token of tokens) {
    const list = grouped.get(token.userId) ?? [];
    list.push(token);
    grouped.set(token.userId, list);
  }

  return grouped;
}
