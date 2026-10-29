import "server-only";

import { buildReminderPayload, type ReminderPayload } from "@/lib/push/payload";
import {
  groupSubscriptionsByUser,
  sendPushSafely,
} from "@/lib/push/batch";
import {
  isReminderTypeEnabled,
  MAX_DELIVERY_ATTEMPTS,
  nextAttemptAt,
  planReminders,
  REMINDER_HORIZON_MS,
} from "@/lib/push/reminder-schedule";
import type {
  PushSender,
  PushSendOutcome,
} from "@/lib/push/sender";
import type {
  AudienceEntry,
  CandidateAssignment,
  DeliveryInsert,
  ReminderStore,
} from "@/lib/push/store";
import type { PushDeliveryClaim } from "@/types/database";

export type SchedulerSummary = {
  candidates: number;
  planned: number;
  enqueued: number;
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
};

export type DeliveryDecision =
  { kind: "skip"; reason: string } | { kind: "send"; payload: ReminderPayload };

/**
 * Re-validates a claimed row against the current database state.
 *
 * The claim query already joined the assignment and preferences, but they may
 * have changed between enqueue and send. A changed or removed deadline means
 * this row is stale: skipping it is the only way to avoid a reminder for a
 * deadline that no longer exists.
 */
export function evaluateClaimedDelivery(
  claim: PushDeliveryClaim,
  nowMs: number,
): DeliveryDecision {
  if (claim.assignment_status !== "published") {
    return { kind: "skip", reason: "assignment_unavailable" };
  }

  if (!claim.current_deadline) {
    return { kind: "skip", reason: "deadline_removed" };
  }

  if (Date.parse(claim.current_deadline) !== Date.parse(claim.deadline_at)) {
    return { kind: "skip", reason: "deadline_changed" };
  }

  if (!claim.push_enabled) {
    return { kind: "skip", reason: "push_disabled" };
  }

  if (
    !isReminderTypeEnabled(claim.reminder_type, {
      reminder24h: claim.reminder_24h,
      reminder3h: claim.reminder_3h,
    })
  ) {
    return { kind: "skip", reason: "reminder_disabled" };
  }

  const payload = buildReminderPayload({
    assignmentId: claim.assignment_id,
    courseName: claim.course_name,
    deadline: claim.deadline_at,
    reminderType: claim.reminder_type,
    timezone: claim.pref_timezone,
    nowMs,
  });

  if (!payload) {
    return { kind: "skip", reason: "invalid_payload" };
  }

  return { kind: "send", payload };
}

/**
 * Runs one reminder pass: enqueue due logical reminders, claim a batch, then
 * deliver to every active device of each user.
 *
 * Durable dedupe lives in the database (`notification_deliveries` unique key)
 * and concurrency is handled by `claim_notification_deliveries`, so two
 * overlapping cron invocations can never send the same logical reminder twice.
 */
export async function runDeadlineReminders(options: {
  store: ReminderStore;
  sender: PushSender;
  now?: Date;
  limit?: number;
}): Promise<SchedulerSummary> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const horizonIso = new Date(nowMs + REMINDER_HORIZON_MS).toISOString();

  const candidates = await options.store.listCandidateAssignments(
    nowIso,
    horizonIso,
  );
  const rows = await planDeliveryRows(options.store, candidates, nowMs);
  const enqueued =
    rows.length > 0 ? await options.store.enqueueDeliveries(rows) : 0;

  const claims = await options.store.claimDeliveries(
    nowIso,
    options.limit ?? 50,
  );
  const summary: SchedulerSummary = {
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
    const decision = evaluateClaimedDelivery(claim, nowMs);

    if (decision.kind === "skip") {
      await options.store.completeDelivery(
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
      await options.store.completeDelivery(
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

async function planDeliveryRows(
  store: ReminderStore,
  candidates: CandidateAssignment[],
  nowMs: number,
): Promise<DeliveryInsert[]> {
  if (candidates.length === 0) {
    return [];
  }

  const audience = await store.listAudience(candidates.map((item) => item.id));
  const assignmentsById = new Map(candidates.map((item) => [item.id, item]));
  const rows: DeliveryInsert[] = [];

  for (const entry of audience) {
    const assignment = assignmentsById.get(entry.assignmentId);

    if (!assignment) {
      continue;
    }

    for (const plan of planReminders(assignment.deadline, nowMs)) {
      if (!isReminderTypeEnabled(plan.reminderType, entry)) {
        continue;
      }

      rows.push(toDeliveryRow(entry, plan));
    }
  }

  return rows;
}

function toDeliveryRow(
  entry: AudienceEntry,
  plan: ReturnType<typeof planReminders>[number],
): DeliveryInsert {
  return {
    user_id: entry.userId,
    assignment_id: entry.assignmentId,
    reminder_type: plan.reminderType,
    deadline_at: plan.deadlineAt,
    scheduled_for: plan.scheduledFor,
    status: "pending",
    next_attempt_at: plan.scheduledFor,
  };
}

async function recordOutcome(
  store: ReminderStore,
  claim: PushDeliveryClaim,
  outcomes: PushSendOutcome[],
  nowMs: number,
  summary: SchedulerSummary,
): Promise<void> {
  if (outcomes.some((outcome) => outcome.ok)) {
    await store.completeDelivery(claim.id, "sent", null, null);
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
    await store.completeDelivery(
      claim.id,
      "pending",
      category,
      nextAttemptAt(claim.attempt_count, nowMs),
    );
    summary.retried += 1;
    return;
  }

  await store.completeDelivery(claim.id, "failed", category, null);
  summary.failed += 1;
}
