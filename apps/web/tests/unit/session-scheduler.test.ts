import { describe, expect, it } from "vitest";

import { runSessionReminders } from "@/lib/push/session-scheduler";
import type { ReminderPayload } from "@/lib/push/payload";
import type {
  CandidateSession,
  SessionAudienceEntry,
  SessionReminderInsert,
  SessionReminderStore,
} from "@/lib/push/session-store";
import type {
  PushSender,
  PushSendOutcome,
  PushTarget,
} from "@/lib/push/sender";
import type { StoredSubscription } from "@/lib/push/store";
import type { SessionReminderClaim } from "@/types/database";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";
const NOW = new Date("2026-11-04T12:00:00.000Z");
const NOW_MS = NOW.getTime();
const HOUR_MS = 60 * 60 * 1000;
const STARTS_AT = new Date(NOW_MS + 24 * HOUR_MS).toISOString();
const ENDS_AT = new Date(NOW_MS + 26 * HOUR_MS).toISOString();

const OK: PushSendOutcome = { ok: true, statusCode: 201 };
const TRANSIENT: PushSendOutcome = {
  ok: false,
  category: "transient",
  statusCode: 503,
  retryable: true,
  disableSubscription: false,
};
const EXPIRED: PushSendOutcome = {
  ok: false,
  category: "expired",
  statusCode: 410,
  retryable: false,
  disableSubscription: true,
};

type Completion = {
  id: string;
  status: "sent" | "failed" | "skipped" | "pending";
  errorCategory: string | null;
  nextAttemptAt: string | null;
};

/** In-memory implementation of the session scheduler's storage contract. */
class FakeStore implements SessionReminderStore {
  candidates: CandidateSession[] = [];
  audience: SessionAudienceEntry[] = [];
  claims: SessionReminderClaim[] = [];
  subscriptions: StoredSubscription[] = [];
  enqueued: SessionReminderInsert[] = [];
  completions: Completion[] = [];
  successes: string[] = [];
  disabled: string[] = [];
  claimLimits: number[] = [];
  candidateRequests: { nowIso: string; horizonIso: string }[] = [];
  audienceRequests: string[][] = [];

  async listCandidateSessions(nowIso: string, horizonIso: string) {
    this.candidateRequests.push({ nowIso, horizonIso });

    return this.candidates;
  }

  async listAudience(sessionIds: string[]) {
    this.audienceRequests.push(sessionIds);

    return this.audience.filter((entry) =>
      sessionIds.includes(entry.sessionId),
    );
  }

  async enqueueReminders(rows: SessionReminderInsert[]) {
    this.enqueued.push(...rows);

    return rows.length;
  }

  async claimReminders(nowIso: string, limit: number) {
    void nowIso;
    this.claimLimits.push(limit);
    const batch = this.claims.slice(0, limit);
    this.claims = this.claims.slice(limit);

    return batch;
  }

  async completeReminder(
    id: string,
    status: "sent" | "failed" | "skipped" | "pending",
    errorCategory: string | null,
    nextAttemptAt: string | null,
  ) {
    this.completions.push({ id, status, errorCategory, nextAttemptAt });

    return true;
  }

  async loadActiveSubscriptions(userIds: string[]) {
    return this.subscriptions.filter((subscription) =>
      userIds.includes(subscription.userId),
    );
  }

  async markSubscriptionSuccess(subscriptionId: string) {
    this.successes.push(subscriptionId);
  }

  async disableSubscription(subscriptionId: string) {
    this.disabled.push(subscriptionId);
  }
}

type RecordingSender = PushSender & {
  sends: { target: PushTarget; payload: ReminderPayload }[];
};

function createSender(
  handler: (target: PushTarget) => PushSendOutcome | Promise<PushSendOutcome>,
): RecordingSender {
  const sends: { target: PushTarget; payload: ReminderPayload }[] = [];

  return {
    sends,
    async send(target, payload) {
      sends.push({ target, payload });

      return handler(target);
    },
  };
}

function makeClaim(
  overrides: Partial<SessionReminderClaim> = {},
): SessionReminderClaim {
  return {
    id: "reminder-1",
    user_id: USER_ID,
    session_id: SESSION_ID,
    reminder_type: "24h",
    starts_at: STARTS_AT,
    attempt_count: 0,
    session_title: "Midterm review",
    session_status: "scheduled",
    session_time_zone: "Asia/Jakarta",
    session_ends_at: ENDS_AT,
    current_starts_at: STARTS_AT,
    class_name: "Algorithms",
    push_enabled: true,
    reminder_24h: true,
    reminder_3h: true,
    pref_timezone: "Asia/Jakarta",
    ...overrides,
  };
}

function makeSubscription(id: string, userId = USER_ID): StoredSubscription {
  return {
    id,
    userId,
    endpoint: `https://push.example.com/send/${id}`,
    p256dh: "B".repeat(20),
    auth: "A".repeat(10),
  };
}

function makeAudience(
  overrides: Partial<SessionAudienceEntry> = {},
): SessionAudienceEntry {
  return {
    sessionId: SESSION_ID,
    userId: USER_ID,
    timezone: "Asia/Jakarta",
    reminder24h: true,
    reminder3h: true,
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<CandidateSession> = {},
): CandidateSession {
  return { id: SESSION_ID, startsAt: STARTS_AT, ...overrides };
}

function first<T>(items: readonly T[]): T {
  const [item] = items;

  if (item === undefined) {
    throw new Error("expected at least one item");
  }

  return item;
}

function run(
  store: FakeStore,
  sender: PushSender,
  options: { limit?: number } = {},
) {
  return runSessionReminders({
    store,
    sender,
    now: NOW,
    ...(options.limit === undefined ? {} : { limit: options.limit }),
  });
}

describe("runSessionReminders", () => {
  it("enqueues the 24-hour reminder for an opted-in attendee", async () => {
    const store = new FakeStore();
    store.candidates = [makeCandidate()];
    store.audience = [makeAudience()];

    const summary = await run(
      store,
      createSender(() => OK),
    );
    const row = first(store.enqueued);

    expect(summary).toMatchObject({
      candidates: 1,
      planned: 1,
      enqueued: 1,
      claimed: 0,
    });
    expect(row).toMatchObject({
      user_id: USER_ID,
      session_id: SESSION_ID,
      reminder_type: "24h",
      starts_at: STARTS_AT,
      scheduled_for: NOW.toISOString(),
      status: "pending",
      next_attempt_at: NOW.toISOString(),
    });
    expect(store.audienceRequests).toEqual([[SESSION_ID]]);
  });

  it("asks for sessions inside the reminder horizon", async () => {
    const store = new FakeStore();

    await run(
      store,
      createSender(() => OK),
    );

    const request = first(store.candidateRequests);

    expect(request.nowIso).toBe(NOW.toISOString());
    expect(request.horizonIso).toBe(
      new Date(NOW_MS + 25 * HOUR_MS).toISOString(),
    );
  });

  it("does not enqueue a reminder window the user turned off", async () => {
    const store = new FakeStore();
    store.candidates = [makeCandidate()];
    store.audience = [makeAudience({ reminder24h: false })];

    const summary = await run(
      store,
      createSender(() => OK),
    );

    expect(summary).toMatchObject({ planned: 0, enqueued: 0 });
    expect(store.enqueued).toEqual([]);
  });

  it("ignores audience rows for sessions outside the candidate set", async () => {
    const store = new FakeStore();
    store.candidates = [makeCandidate()];
    store.audience = [
      makeAudience({ sessionId: "99999999-9999-4999-8999-999999999999" }),
    ];

    const summary = await run(
      store,
      createSender(() => OK),
    );

    expect(summary.planned).toBe(0);
    expect(store.enqueued).toEqual([]);
  });

  it("sends to every active device and records one logical success", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim()];
    store.subscriptions = [
      makeSubscription("device-1"),
      makeSubscription("device-2"),
    ];
    const sender = createSender(() => OK);

    const summary = await run(store, sender);

    expect(summary).toMatchObject({
      claimed: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    expect(sender.sends).toHaveLength(2);
    expect(first(sender.sends).payload.url).toBe(`/sessions/${SESSION_ID}`);
    expect(store.successes).toEqual(["device-1", "device-2"]);
    expect(first(store.completions)).toEqual({
      id: "reminder-1",
      status: "sent",
      errorCategory: null,
      nextAttemptAt: null,
    });
  });

  it("skips a session that was cancelled after the reminder was queued", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim({ session_status: "cancelled" })];
    store.subscriptions = [makeSubscription("device-1")];
    const sender = createSender(() => OK);

    const summary = await run(store, sender);

    expect(summary.skipped).toBe(1);
    expect(sender.sends).toEqual([]);
    expect(first(store.completions)).toMatchObject({
      status: "skipped",
      errorCategory: "session_not_scheduled",
    });
  });

  it("skips when the start time moved after the reminder was queued", async () => {
    const store = new FakeStore();
    store.claims = [
      makeClaim({
        current_starts_at: new Date(NOW_MS + 30 * HOUR_MS).toISOString(),
      }),
    ];
    store.subscriptions = [makeSubscription("device-1")];

    const summary = await run(
      store,
      createSender(() => OK),
    );

    expect(summary.skipped).toBe(1);
    expect(first(store.completions).errorCategory).toBe("schedule_changed");
  });

  it("skips when the user has no active device", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim()];
    const sender = createSender(() => OK);

    const summary = await run(store, sender);

    expect(summary.skipped).toBe(1);
    expect(sender.sends).toEqual([]);
    expect(first(store.completions).errorCategory).toBe("no_device");
  });

  it("requeues a transient failure with backoff", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim({ attempt_count: 0 })];
    store.subscriptions = [makeSubscription("device-1")];

    const summary = await run(
      store,
      createSender(() => TRANSIENT),
    );

    expect(summary.retried).toBe(1);
    expect(first(store.completions)).toEqual({
      id: "reminder-1",
      status: "pending",
      errorCategory: "transient",
      nextAttemptAt: new Date(NOW_MS + 5 * 60_000).toISOString(),
    });
  });

  it("disables an expired subscription and fails the reminder", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim()];
    store.subscriptions = [makeSubscription("device-1")];

    const summary = await run(
      store,
      createSender(() => EXPIRED),
    );

    expect(summary.failed).toBe(1);
    expect(store.disabled).toEqual(["device-1"]);
    expect(first(store.completions)).toMatchObject({
      status: "failed",
      errorCategory: "expired",
    });
  });

  it("stops retrying once the attempt limit is reached", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim({ attempt_count: 3 })];
    store.subscriptions = [makeSubscription("device-1")];

    const summary = await run(
      store,
      createSender(() => TRANSIENT),
    );

    expect(summary.failed).toBe(1);
    expect(first(store.completions)).toMatchObject({
      status: "failed",
      errorCategory: "transient",
    });
  });

  it("treats a thrown sender as a transient failure", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim()];
    store.subscriptions = [makeSubscription("device-1")];
    const sender = createSender(() => {
      throw new Error("socket hang up");
    });

    const summary = await run(store, sender);

    expect(summary.retried).toBe(1);
    expect(first(store.completions)).toMatchObject({
      status: "pending",
      errorCategory: "transient",
    });
  });

  it("does not send the same reminder twice when two runs overlap", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim()];
    store.subscriptions = [makeSubscription("device-1")];
    const sender = createSender(() => OK);

    const [firstRun, secondRun] = await Promise.all([
      run(store, sender),
      run(store, sender),
    ]);

    expect(sender.sends).toHaveLength(1);
    expect(store.completions).toHaveLength(1);
    expect(firstRun.sent + secondRun.sent).toBe(1);
  });

  it("passes the batch limit to the claim query", async () => {
    const store = new FakeStore();

    await run(
      store,
      createSender(() => OK),
      { limit: 7 },
    );

    expect(store.claimLimits.at(-1)).toBe(7);
  });

  it("returns an empty summary when nothing is due", async () => {
    const store = new FakeStore();

    const summary = await run(
      store,
      createSender(() => OK),
    );

    expect(summary).toEqual({
      candidates: 0,
      planned: 0,
      enqueued: 0,
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
    });
    expect(store.audienceRequests).toEqual([]);
  });
});
