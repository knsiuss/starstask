import "server-only";

import { groupSubscriptionsByUser, sendPushSafely } from "@/lib/push/batch";
import { nextAttemptAt } from "@/lib/push/reminder-schedule";
import {
  evaluateSessionReminder,
  MAX_DELIVERY_ATTEMPTS,
  planSessionReminders,
  SESSION_REMINDER_HORIZON_MS,
} from "@/lib/push/session-reminder-schedule";
import type {
  CandidateSession,
  SessionAudienceEntry,
  SessionReminderStore,
} from "@/lib/push/session-store";
import type { PushSender, PushSendOutcome } from "@/lib/push/sender";
import type { SessionReminderClaim } from "@/types/database";

export type SessionReminderSummary = {
  candidates: number;
  planned: number;
  enqueued: number;
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
};

/**
 * Runs one reminder pass for discussion sessions.
 *
 * Same shape as the deadline scheduler: plan into a durable ledger, claim a
 * batch with `FOR UPDATE SKIP LOCKED`, re-validate each row against the current
 * database state, then deliver to every active device. Because the ledger lives
 * in Postgres, a closed browser or an offline user does not stop delivery.
 */
export async function runSessionReminders(options: {
  store: SessionReminderStore;
  sender: PushSender;
  now?: Date;
  limit?: number;
}): Promise<SessionReminderSummary> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const horizonIso = new Date(
    nowMs + SESSION_REMINDER_HORIZON_MS,
  ).toISOString();

  const candidates = await options.store.listCandidateSessions(
    nowIso,
    horizonIso,
  );
  const rows = await planReminderRows(options.store, candidates, nowMs);
  const enqueued =
    rows.length > 0 ? await options.store.enqueueReminders(rows) : 0;

  const claims = await options.store.claimReminders(
    nowIso,
    options.limit ?? 50,
  );
  const summary: SessionReminderSummary = {
    candidates: candidates.length,
    planned: rows.length,
    enqueued,
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
    const decision = evaluateSessionReminder(claim, nowMs);

    if (decision.kind === "skip") {
      await options.store.completeReminder(
        claim.id,
        "skipped",
        decision.reason,
        null,
      );
      summary.skipped += 1;
      continue;
    }

    const targets = subscriptionsByUser.get(claim.user_id) ?? [];

    if (targets.length === 0) {
      await options.store.completeReminder(
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
        const outcome = await sendPushSafely(
          options.sender,
          target,
          decision.payload,
        );

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

async function planReminderRows(
  store: SessionReminderStore,
  candidates: CandidateSession[],
  nowMs: number,
): Promise<Parameters<SessionReminderStore["enqueueReminders"]>[0]> {
  if (candidates.length === 0) {
    return [];
  }

  const audience = await store.listAudience(candidates.map((item) => item.id));
  const sessionsById = new Map(candidates.map((item) => [item.id, item]));
  const rows: Parameters<SessionReminderStore["enqueueReminders"]>[0] = [];

  for (const entry of audience) {
    const session = sessionsById.get(entry.sessionId);

    if (!session) {
      continue;
    }

    for (const plan of planSessionReminders(session.startsAt, nowMs)) {
      if (!isReminderEnabled(plan.reminderType, entry)) {
        continue;
      }

      rows.push({
        user_id: entry.userId,
        session_id: entry.sessionId,
        reminder_type: plan.reminderType,
        starts_at: plan.startsAt,
        scheduled_for: plan.scheduledFor,
        status: "pending",
        next_attempt_at: plan.scheduledFor,
      });
    }
  }

  return rows;
}

function isReminderEnabled(
  reminderType: "24h" | "3h",
  entry: SessionAudienceEntry,
): boolean {
  return reminderType === "24h" ? entry.reminder24h : entry.reminder3h;
}

async function recordOutcome(
  store: SessionReminderStore,
  claim: SessionReminderClaim,
  outcomes: PushSendOutcome[],
  nowMs: number,
  summary: SessionReminderSummary,
): Promise<void> {
  if (outcomes.some((outcome) => outcome.ok)) {
    await store.completeReminder(claim.id, "sent", null, null);
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
    await store.completeReminder(
      claim.id,
      "pending",
      category,
      nextAttemptAt(claim.attempt_count, nowMs),
    );
    summary.retried += 1;
    return;
  }

  await store.completeReminder(claim.id, "failed", category, null);
  summary.failed += 1;
}
