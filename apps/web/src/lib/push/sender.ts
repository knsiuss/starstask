import "server-only";

import webpush from "web-push";

import type { PushConfig } from "@/lib/push/config";
import type { ReminderPayload } from "@/lib/push/payload";

export type PushTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Failure categories stored in `notification_deliveries.last_error_category`.
 * They are short, non-sensitive labels, never raw provider responses.
 */
export type PushErrorCategory =
  "expired" | "unauthorized" | "invalid" | "rate_limited" | "transient";

export type PushSendOutcome =
  | { ok: true; statusCode: number }
  | {
      ok: false;
      category: PushErrorCategory;
      statusCode: number | null;
      retryable: boolean;
      disableSubscription: boolean;
    };

export interface PushSender {
  send(target: PushTarget, payload: ReminderPayload): Promise<PushSendOutcome>;
}

/** Push services are external I/O; never let a hung socket block the batch. */
const SEND_TIMEOUT_MS = 10_000;

/**
 * Classifies a `web-push` failure without logging the endpoint or response body.
 *
 * 404/410 means the subscription is gone for good, so the caller disables it.
 * 4xx validation failures are permanent for this delivery but the subscription
 * may still be valid (for example a payload the service rejected).
 */
export function classifyPushError(error: unknown): PushSendOutcome {
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : null;

  if (statusCode === 404 || statusCode === 410) {
    return {
      ok: false,
      category: "expired",
      statusCode,
      retryable: false,
      disableSubscription: true,
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      ok: false,
      category: "unauthorized",
      statusCode,
      retryable: true,
      disableSubscription: false,
    };
  }

  if (statusCode === 429) {
    return {
      ok: false,
      category: "rate_limited",
      statusCode,
      retryable: true,
      disableSubscription: false,
    };
  }

  if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
    return {
      ok: false,
      category: "invalid",
      statusCode,
      retryable: false,
      disableSubscription: false,
    };
  }

  return {
    ok: false,
    category: "transient",
    statusCode,
    retryable: true,
    disableSubscription: false,
  };
}

/**
 * Creates the production sender. VAPID details are passed per request instead
 * of calling `setVapidDetails`, so concurrent configuration changes can never
 * leak between requests.
 */
export function createWebPushSender(config: PushConfig): PushSender {
  return {
    async send(target, payload) {
      try {
        const result = await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          JSON.stringify(payload),
          {
            vapidDetails: {
              subject: config.subject,
              publicKey: config.publicKey,
              privateKey: config.privateKey,
            },
            // The reminder is only useful before the deadline. A push service
            // holding it for four weeks would deliver it far too late.
            TTL: 60 * 60,
            urgency: "normal",
            timeout: SEND_TIMEOUT_MS,
          },
        );

        return { ok: true, statusCode: result.statusCode };
      } catch (error) {
        return classifyPushError(error);
      }
    },
  };
}
