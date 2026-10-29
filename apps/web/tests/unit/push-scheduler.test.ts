import { describe, expect, it } from "vitest";

import type { ReminderPayload } from "@/lib/push/payload";
import {
  evaluateClaimedDelivery,
  runDeadlineReminders,
} from "@/lib/push/scheduler";
import type {
  PushSender,
  PushSendOutcome,
  PushTarget,
} from "@/lib/push/sender";
import type {
  AudienceEntry,
  CandidateAssignment,
  DeliveryInsert,
  ReminderStore,
  StoredSubscription,
} from "@/lib/push/store";
import type { DeliveryStatusRow, PushDeliveryClaim } from "@/types/database";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const ASSIGNMENT_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";
const NOW = new Date("2026-10-29T03:00:00.000Z");
const NOW_MS = NOW.getTime();
const DEADLINE = new Date(NOW_MS + 24 * 60 * 60 * 1000).toISOString();

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
  status: DeliveryStatusRow;
  errorCategory: string | null;
  nextAttemptAt: string | null;
};

/** In-memory implementation of the scheduler's storage contract. */
class FakeStore implements ReminderStore {
  candidates: CandidateAssignment[] = [];
  audience: AudienceEntry[] = [];
  claims: PushDeliveryClaim[] = [];
  subscriptions: StoredSubscription[] = [];
  enqueued: DeliveryInsert[] = [];
  completions: Completion[] = [];
  successes: string[] = [];
  disabled: string[] = [];
  audienceRequests: string[][] = [];
  subscriptionRequests: string[][] = [];
  claimLimits: number[] = [];
  candidateRequests: { nowIso: string; horizonIso: string }[] = [];

  async listCandidateAssignments(nowIso: string, horizonIso: string) {
    this.candidateRequests.push({ nowIso, horizonIso });

    return this.candidates;
  }

  async listAudience(assignmentIds: string[]) {
    this.audienceRequests.push(assignmentIds);

    return this.audience.filter((entry) =>
      assignmentIds.includes(entry.assignmentId),
    );
  }

  async enqueueDeliveries(rows: DeliveryInsert[]) {
    this.enqueued.push(...rows);

    return rows.length;
  }

  async claimDeliveries(nowIso: string, limit: number) {
    void nowIso;
    this.claimLimits.push(limit);
    const batch = this.claims.slice(0, limit);
    this.claims = this.claims.slice(limit);

    return batch;
  }

  async completeDelivery(
    id: string,
    status: DeliveryStatusRow,
    errorCategory: string | null,
    nextAttemptAt: string | null,
  ) {
    this.completions.push({ id, status, errorCategory, nextAttemptAt });

    return true;
  }

  async loadActiveSubscriptions(userIds: string[]) {
    this.subscriptionRequests.push(userIds);

    return this.subscriptions.filter((subscription) =>
      userIds.includes(subscription.userId),
    );
  }

  async markSubscriptionSuccess(subscriptionId: string, atIso: string) {
    void atIso;
    this.successes.push(subscriptionId);
  }

  async disableSubscription(subscriptionId: string, atIso: string) {
    void atIso;
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
  overrides: Partial<PushDeliveryClaim> = {},
): PushDeliveryClaim {
  return {
    id: "delivery-1",
    user_id: USER_ID,
    assignment_id: ASSIGNMENT_ID,
    reminder_type: "24h",
    deadline_at: DEADLINE,
    attempt_count: 0,
    assignment_title: "Graph essay",
    course_name: "Algorithms",
    current_deadline: DEADLINE,
    assignment_status: "published",
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

function makeAudience(overrides: Partial<AudienceEntry> = {}): AudienceEntry {
  return {
    assignmentId: ASSIGNMENT_ID,
    userId: USER_ID,
    timezone: "Asia/Jakarta",
    reminder24h: true,
    reminder3h: true,
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<CandidateAssignment> = {},
): CandidateAssignment {
  return {
    id: ASSIGNMENT_ID,
    ownerId: USER_ID,
    deadline: DEADLINE,
    ...overrides,
  };
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
  return runDeadlineReminders({
    store,
    sender,
    now: NOW,
    ...(options.limit === undefined ? {} : { limit: options.limit }),
  });
}

describe("evaluateClaimedDelivery", () => {
  it("builds a payload for a still-valid claim", () => {
    const decision = evaluateClaimedDelivery(makeClaim(), NOW_MS);

    expect(decision.kind).toBe("send");
    expect(decision.kind === "send" ? decision.payload.url : null).toBe(
      `/assignments/${ASSIGNMENT_ID}`,
    );
  });

  it.each([
    {
      label: "the assignment is unpublished",
      overrides: { assignment_status: "pending" },
      reason: "assignment_unavailable",
    },
    {
      label: "the deadline was removed",
      overrides: { current_deadline: null },
      reason: "deadline_removed",
    },
    {
      label: "the deadline changed",
      overrides: {
        current_deadline: new Date(NOW_MS + 3 * 3600_000).toISOString(),
      },
      reason: "deadline_changed",
    },
    {
      label: "push was turned off",
      overrides: { push_enabled: false },
      reason: "push_disabled",
    },
    {
      label: "the reminder type was disabled",
      overrides: { reminder_24h: false },
      reason: "reminder_disabled",
    },
    {
      label: "the assignment id is invalid",
      overrides: { assignment_id: "not-a-uuid" },
      reason: "invalid_payload",
    },
  ])("skips when $label", ({ overrides, reason }) => {
    const decision = evaluateClaimedDelivery(makeClaim(overrides), NOW_MS);

    expect(decision).toEqual({ kind: "skip", reason });
  });
});

describe("runDeadlineReminders", () => {
  it("enqueues a reminder for an opted-in owner", async () => {
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
      assignment_id: ASSIGNMENT_ID,
      reminder_type: "24h",
      deadline_at: DEADLINE,
      scheduled_for: NOW.toISOString(),
      status: "pending",
      next_attempt_at: NOW.toISOString(),
    });
    expect(store.audienceRequests).toEqual([[ASSIGNMENT_ID]]);
  });

  it("does not enqueue a reminder type the user turned off", async () => {
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

  it("ignores audience rows for assignments outside the candidate set", async () => {
    const store = new FakeStore();
    store.candidates = [makeCandidate()];
    store.audience = [
      makeAudience({ assignmentId: "99999999-9999-4999-8999-999999999999" }),
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
    expect(store.successes).toEqual(["device-1", "device-2"]);
    expect(first(store.completions)).toEqual({
      id: "delivery-1",
      status: "sent",
      errorCategory: null,
      nextAttemptAt: null,
    });
  });

  it("loads subscriptions once per unique user", async () => {
    const store = new FakeStore();
    store.claims = [
      makeClaim({ id: "delivery-1" }),
      makeClaim({ id: "delivery-2", reminder_type: "3h" }),
    ];
    store.subscriptions = [makeSubscription("device-1")];

    await run(
      store,
      createSender(() => OK),
    );

    expect(store.subscriptionRequests).toEqual([[USER_ID]]);
  });

  it("skips an unpublished assignment instead of sending", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim({ assignment_status: "pending" })];
    store.subscriptions = [makeSubscription("device-1")];
    const sender = createSender(() => OK);

    const summary = await run(store, sender);

    expect(summary.skipped).toBe(1);
    expect(sender.sends).toEqual([]);
    expect(first(store.completions)).toMatchObject({
      status: "skipped",
      errorCategory: "assignment_unavailable",
    });
  });

  it("skips when the deadline changed after enqueueing", async () => {
    const store = new FakeStore();
    store.claims = [
      makeClaim({
        current_deadline: new Date(NOW_MS + 3600_000).toISOString(),
      }),
    ];
    store.subscriptions = [makeSubscription("device-1")];

    const summary = await run(
      store,
      createSender(() => OK),
    );

    expect(summary.skipped).toBe(1);
    expect(first(store.completions).errorCategory).toBe("deadline_changed");
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
      id: "delivery-1",
      status: "pending",
      errorCategory: "transient",
      nextAttemptAt: new Date(NOW_MS + 5 * 60_000).toISOString(),
    });
  });

  it("disables an expired subscription and fails the delivery", async () => {
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

  it("counts a delivery as sent when at least one device succeeds", async () => {
    const store = new FakeStore();
    store.claims = [makeClaim()];
    store.subscriptions = [
      makeSubscription("device-1"),
      makeSubscription("device-2"),
    ];
    const sender = createSender((target) =>
      target.id === "device-1" ? OK : EXPIRED,
    );

    const summary = await run(store, sender);

    expect(summary.sent).toBe(1);
    expect(store.disabled).toEqual(["device-2"]);
    expect(store.successes).toEqual(["device-1"]);
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

  it("does not send the same claim twice when two runs overlap", async () => {
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

  it("returns an empty summary when no assignment is due", async () => {
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
