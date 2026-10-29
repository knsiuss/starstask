import "server-only";

import {
  groupSubscriptionsByUser,
  sendPushSafely,
} from "@/lib/push/batch";
import type { NotificationEventStore } from "@/lib/push/event-store";
import {
  isSafeNotificationPath,
  NOTIFICATION_BADGE,
  NOTIFICATION_ICON,
  type ReminderPayload,
} from "@/lib/push/payload";
import {
  MAX_DELIVERY_ATTEMPTS,
  nextAttemptAt,
} from "@/lib/push/reminder-schedule";
import type { PushSender, PushSendOutcome } from "@/lib/push/sender";
import type { Json, NotificationEventClaim } from "@/types/database";

export type NotificationEventSummary = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
};

/**
 * Turns a stored event into a push payload.
 *
 * The database only ever stores a title, a body, and an internal URL, but this
 * still validates every field: the URL must pass the same allowlist the service
 * worker enforces, so a bad row can never become an open redirect.
 *
 * @returns `null` when the row cannot produce a safe payload; the caller then
 * marks the event as skipped instead of sending.
 */
export function buildEventPayload(
  claim: NotificationEventClaim,
  nowMs: number,
): ReminderPayload | null {
  if (!isJsonObject(claim.payload)) {
    return null;
  }

  const title = readString(claim.payload.title);
  const body = readString(claim.payload.body);
  const url = readString(claim.payload.url);

  if (!title || !body || !url || !isSafeNotificationPath(url)) {
    return null;
  }

  return {
    title: truncate(title, 120),
    body: truncate(body, 240),
    url,
    tag: `starstask:event:${claim.id}`,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    timestamp: nowMs,
  };
}

/**
 * Runs one event pass: claim a batch, then deliver to every active device.
 *
 * Concurrency is handled by `claim_notification_events` (FOR UPDATE SKIP
 * LOCKED), so two overlapping cron runs can never send the same event twice.
 */
export async function runNotificationEvents(options: {
  store: NotificationEventStore;
  sender: PushSender;
  now?: Date;
  limit?: number;
}): Promise<NotificationEventSummary> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  const claims = await options.store.claimEvents(
    nowIso,
    options.limit ?? 50,
  );
  const summary: NotificationEventSummary = {
    claimed: claims.length,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
  };

  if (claims.length === 0) {
    return summary;
  }

  const subscriptions = await options.store.loadActiveSubscriptions([
    ...new Set(claims.map((claim) => claim.user_id)),
  ]);
  const subscriptionsByUser = groupSubscriptionsByUser(subscriptions);

  for (const claim of claims) {
    const payload = buildEventPayload(claim, nowMs);

    if (!payload) {
      await options.store.completeEvent(
        claim.id,
        "skipped",
        "invalid_payload",
        null,
      );
      summary.skipped += 1;
      continue;
    }

    const targets = subscriptionsByUser.get(claim.user_id) ?? [];

    if (targets.length === 0) {
      await options.store.completeEvent(
        claim.id,
        "skipped",
        "no_device",
        null,
      );
      summary.skipped += 1;
      continue;
    }

    const outcomes = await Promise.all(
      targets.map(async (target) => {
        const outcome = await sendPushSafely(options.sender, target, payload);

        if (outcome.ok) {
          await options.store.markSubscriptionSuccess(target.id, nowIso);
        } else if (outcome.disableSubscription) {
          await options.store.disableSubscription(target.id, nowIso);
        }

        return outcome;
      }),
    );

    await recordOutcome(options.store, claim, outcomes, nowMs, summary);
  }

  return summary;
}

async function recordOutcome(
  store: NotificationEventStore,
  claim: NotificationEventClaim,
  outcomes: PushSendOutcome[],
  nowMs: number,
  summary: NotificationEventSummary,
): Promise<void> {
  if (outcomes.some((outcome) => outcome.ok)) {
    await store.completeEvent(claim.id, "sent", null, null);
    summary.sent += 1;
    return;
  }

  const failure = outcomes.find(
    (outcome): outcome is Extract<PushSendOutcome, { ok: false }> =>
      !outcome.ok,
  );
  const category = failure?.category ?? "transient";
  const canRetry =
    outcomes.some((outcome) => !outcome.ok && outcome.retryable) &&
    claim.attempt_count < MAX_DELIVERY_ATTEMPTS;

  if (canRetry) {
    await store.completeEvent(
      claim.id,
      "pending",
      category,
      nextAttemptAt(claim.attempt_count, nowMs),
    );
    summary.retried += 1;
    return;
  }

  await store.completeEvent(claim.id, "failed", category, null);
  summary.failed += 1;
}

function isJsonObject(
  value: Json,
): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: Json | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}
