import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Hand-written in-test IndexedDB stub (no new dependencies, per the milestone
 * spec). The fake is synchronous-in-behaviour but asynchronous in dispatch:
 * results are delivered in microtasks so callers can attach handlers after
 * the store method returns, mirroring real IndexedDB.
 *
 * This stub is intentionally self-contained per test file; the milestone does
 * not allow a shared helper module.
 */

type StoreRecord = {
  keyPath: string;
  values: Map<string, unknown>;
};

function recordKeyOf(record: StoreRecord, value: unknown): string {
  const key = (value as Record<string, unknown>)[record.keyPath];

  if (typeof key !== "string") {
    throw new Error("stub records must carry a string key");
  }

  return key;
}

class FakeRequest<T> {
  result!: T;
  error: Error | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: (() => void) | null = null;
  onblocked: (() => void) | null = null;
}

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  error: Error | null = null;
  private pending = 0;
  private completed = false;

  constructor(private readonly harness: Harness) {
    queueMicrotask(() => {
      if (this.pending === 0 && !this.completed) {
        this.markCompleted();
      }
    });
  }

  objectStore(name: string): FakeObjectStore {
    const record = this.harness.stores.get(name);

    if (!record) {
      throw new Error(`stub: unknown object store ${name}`);
    }

    return new FakeObjectStore(this.harness, record, this);
  }

  noteRequestStart(): void {
    this.pending += 1;
  }

  noteRequestEnd(): void {
    this.pending -= 1;

    if (this.pending === 0) {
      this.markCompleted();
    }
  }

  private markCompleted(): void {
    if (this.completed) {
      return;
    }

    this.completed = true;
    queueMicrotask(() => this.oncomplete?.());
  }
}

class FakeObjectStore {
  constructor(
    private readonly harness: Harness,
    private readonly record: StoreRecord,
    private readonly transaction: FakeTransaction,
  ) {}

  add(value: unknown): FakeRequest<string> {
    const request = new FakeRequest<string>();

    this.transaction.noteRequestStart();
    queueMicrotask(() => {
      const key = recordKeyOf(this.record, value);

      if (this.record.values.has(key)) {
        this.fail(request, new Error("ConstraintError"));
        return;
      }

      this.record.values.set(key, structuredClone(value));
      this.succeed(request, key);
    });

    return request;
  }

  put(value: unknown): FakeRequest<string> {
    const request = new FakeRequest<string>();

    this.transaction.noteRequestStart();
    queueMicrotask(() => {
      if (this.harness.failNextRequests > 0) {
        this.harness.failNextRequests -= 1;
        this.fail(request, new Error("QuotaExceededError"));
        return;
      }

      const key = recordKeyOf(this.record, value);

      this.record.values.set(key, structuredClone(value));
      this.succeed(request, key);
    });

    return request;
  }

  get(key: string): FakeRequest<unknown> {
    const request = new FakeRequest<unknown>();

    this.transaction.noteRequestStart();
    queueMicrotask(() => {
      if (this.harness.failNextRequests > 0) {
        this.harness.failNextRequests -= 1;
        this.fail(request, new Error("QuotaExceededError"));
        return;
      }

      const value = this.record.values.get(key);

      this.succeed(
        request,
        value === undefined ? undefined : structuredClone(value),
      );
    });

    return request;
  }

  getAll(): FakeRequest<unknown[]> {
    const request = new FakeRequest<unknown[]>();

    this.transaction.noteRequestStart();
    queueMicrotask(() => {
      if (this.harness.failNextRequests > 0) {
        this.harness.failNextRequests -= 1;
        this.fail(request, new Error("QuotaExceededError"));
        return;
      }

      const values = [...this.record.values.values()].map((value) =>
        structuredClone(value),
      );

      this.succeed(request, values);
    });

    return request;
  }

  delete(key: string): FakeRequest<undefined> {
    const request = new FakeRequest<undefined>();

    this.transaction.noteRequestStart();
    queueMicrotask(() => {
      this.record.values.delete(key);
      this.succeed(request, undefined);
    });

    return request;
  }

  clear(): FakeRequest<undefined> {
    const request = new FakeRequest<undefined>();

    this.transaction.noteRequestStart();
    queueMicrotask(() => {
      this.record.values.clear();
      this.succeed(request, undefined);
    });

    return request;
  }

  private succeed<T>(request: FakeRequest<T>, result: T): void {
    request.result = result;
    request.onsuccess?.();
    this.transaction.noteRequestEnd();
  }

  private fail<T>(request: FakeRequest<T>, error: Error): void {
    request.error = error;
    request.onerror?.();
    this.transaction.noteRequestEnd();
  }
}

class FakeDatabase {
  constructor(private readonly harness: Harness) {}

  get objectStoreNames() {
    return {
      contains: (name: string) => this.harness.stores.has(name),
    };
  }

  createObjectStore(name: string, options: { keyPath: string }): void {
    if (this.harness.stores.has(name)) {
      throw new Error(`stub: object store ${name} already exists`);
    }

    this.harness.stores.set(name, {
      keyPath: options.keyPath,
      values: new Map(),
    });
  }

  transaction(): FakeTransaction {
    return new FakeTransaction(this.harness);
  }

  close(): void {}
}

class Harness {
  readonly stores = new Map<string, StoreRecord>();
  failNextRequests = 0;
  version = 0;

  readonly factory = {
    open: (name: string, version: number) => this.open(name, version),
  };

  private open(_name: string, version: number): FakeRequest<FakeDatabase> {
    const request = new FakeRequest<FakeDatabase>();
    const database = new FakeDatabase(this);
    const needsUpgrade = version > this.version;

    queueMicrotask(() => {
      if (needsUpgrade) {
        this.version = version;
        request.result = database;
        request.onupgradeneeded?.();
      }

      request.result = database;
      request.onsuccess?.();
    });

    return request;
  }
}

const harness = new Harness();

const originalIndexedDb = globalThis.indexedDB;

function installFakeIndexedDb(): void {
  harness.stores.clear();
  harness.failNextRequests = 0;
  harness.version = 0;

  // The stub structurally covers the slice of the IDBFactory API used by
  // lib/offline/db.ts; it is not a complete IDB implementation.
  globalThis.indexedDB = harness.factory as unknown as IDBFactory;
}

function uninstallFakeIndexedDb(): void {
  if (originalIndexedDb === undefined) {
    // @ts-expect-error -- removing the global we replaced for these tests
    delete globalThis.indexedDB;
    return;
  }

  globalThis.indexedDB = originalIndexedDb;
}

const MEETING_BODY = {
  fullName: "Test Mahasiswa",
  nim: "123456789",
  latitude: -6.2,
  longitude: 106.8,
  accuracy: 12,
};

const SESSION_BODY = {
  latitude: -6.2,
  longitude: 106.8,
  accuracy: 12,
};

function okMeetingResponse(): Response {
  return new Response(
    JSON.stringify({
      data: {
        status: "present",
        checkedInAt: "2026-11-18T01:00:00.000Z",
        distanceM: 5,
        accuracyM: 12,
        alreadyCheckedIn: false,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function okSessionResponse(): Response {
  return new Response(
    JSON.stringify({
      data: {
        checkIn: {
          id: "checkin-1",
          status: "late",
          checkedInAt: "2026-11-18T01:00:00.000Z",
          distanceM: 5,
          accuracyM: 12,
          alreadyCheckedIn: true,
        },
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function errorResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: { code, message: "x" } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  installFakeIndexedDb();
});

afterEach(() => {
  uninstallFakeIndexedDb();
});

async function loadOutbox() {
  return import("@/lib/offline/checkin-outbox");
}

describe("enqueue", () => {
  it("derives the meeting endpoint from the kind literal", async () => {
    const { enqueue } = await loadOutbox();
    const entry = await enqueue(
      "attendance-meeting",
      "meeting-1",
      MEETING_BODY,
    );

    expect(entry.endpoint).toBe("/api/attendance/meetings/meeting-1/checkin");
    expect(entry.status).toBe("pending_sync");
    expect(entry.attempts).toBe(0);
  });

  it("derives the session endpoint from the kind literal", async () => {
    const { enqueue } = await loadOutbox();
    const entry = await enqueue("session", "session-1", SESSION_BODY);

    expect(entry.endpoint).toBe("/api/sessions/session-1/checkin");
  });

  it("rejects an unknown kind", async () => {
    const { enqueue } = await loadOutbox();

    await expect(
      enqueue("not-a-kind" as unknown as "session", "s", SESSION_BODY),
    ).rejects.toThrow();
  });

  it("generates a unique clientRequestId per tap", async () => {
    const { enqueue } = await loadOutbox();
    const first = await enqueue("session", "session-2", SESSION_BODY);
    const second = await enqueue("session", "session-2", SESSION_BODY);

    expect(first.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(first.id).not.toBe(second.id);
  });
});

describe("flush", () => {
  it("replay POST body for a meeting omits capturedAt entirely", async () => {
    const { enqueue, flush } = await loadOutbox();

    await enqueue("attendance-meeting", "meeting-9", MEETING_BODY);

    const calls: Array<{ url: string; body: unknown }> = [];

    const fetchImpl: typeof fetch = (async (
      url: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      calls.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      return okMeetingResponse();
    }) as typeof fetch;

    await flush(fetchImpl);

    expect(calls).toHaveLength(1);
    const call = calls[0];

    if (!call) {
      throw new Error("expected one replay call");
    }

    const body = call.body as Record<string, unknown>;

    expect(body).toEqual({
      fullName: "Test Mahasiswa",
      nim: "123456789",
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 12,
    });
    expect(body).not.toHaveProperty("capturedAt");
  });

  it("session replay body also omits capturedAt", async () => {
    const { enqueue, flush, list } = await loadOutbox();

    await enqueue("session", "session-9", SESSION_BODY);

    const seenBodies: unknown[] = [];

    const fetchImpl: typeof fetch = (async (
      _url: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      seenBodies.push(init?.body ? JSON.parse(String(init.body)) : null);

      return okSessionResponse();
    }) as typeof fetch;

    const result = await flush(fetchImpl);

    expect(result.sent).toBe(1);
    expect(seenBodies[0]).toEqual(SESSION_BODY);
    expect(seenBodies[0]).not.toHaveProperty("capturedAt");

    const [entry] = await list();

    expect(entry?.status).toBe("sent");
    expect(entry?.serverStatus).toBe("late");
    expect(entry?.alreadyCheckedIn).toBe(true);
  });

  it("replays in FIFO order by createdAt", async () => {
    const { enqueue, flush } = await loadOutbox();

    const first = await enqueue("session", "session-a", SESSION_BODY);
    const second = await enqueue("session", "session-b", SESSION_BODY);

    const order: string[] = [];

    const fetchImpl: typeof fetch = (async (url: RequestInfo | URL) => {
      order.push(String(url));

      return okSessionResponse();
    }) as typeof fetch;

    await flush(fetchImpl);

    expect(order).toEqual([first.endpoint, second.endpoint]);
  });

  it("marks entries failed on terminal error codes", async () => {
    const { enqueue, flush, list } = await loadOutbox();

    await enqueue("attendance-meeting", "meeting-2", MEETING_BODY);

    const fetchImpl: typeof fetch = (async () =>
      errorResponse(409, "checkin_closed")) as typeof fetch;

    const result = await flush(fetchImpl);

    expect(result.failed).toBe(1);
    expect(result.sessionExpired).toBe(false);

    const [entry] = await list();

    expect(entry?.status).toBe("failed");
    expect(entry?.lastError).toBe("checkin_closed");
  });

  it("keeps the entry pending_sync and flags sessionExpired on HTTP 401", async () => {
    const { enqueue, flush, list } = await loadOutbox();

    await enqueue("session", "session-3", SESSION_BODY);

    const fetchImpl: typeof fetch = (async () =>
      errorResponse(401, "unauthorized")) as typeof fetch;

    const result = await flush(fetchImpl);

    expect(result.sessionExpired).toBe(true);

    const [entry] = await list();

    expect(entry?.status).toBe("pending_sync");
    expect(entry?.attempts).toBe(0);
    expect(entry?.lastError).toBe("http_401");
  });

  it("increments attempts and keeps pending_sync on a network failure", async () => {
    const { enqueue, flush, list } = await loadOutbox();

    await enqueue("session", "session-4", SESSION_BODY);

    const fetchImpl: typeof fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;

    const result = await flush(fetchImpl);

    expect(result.retried).toBe(1);

    const [entry] = await list();

    expect(entry?.status).toBe("pending_sync");
    expect(entry?.attempts).toBe(1);
  });

  it("increments attempts and keeps pending_sync on HTTP 5xx", async () => {
    const { enqueue, flush, list } = await loadOutbox();

    await enqueue("session", "session-5", SESSION_BODY);

    const fetchImpl: typeof fetch = (async () =>
      errorResponse(503, "service_unavailable")) as typeof fetch;

    const result = await flush(fetchImpl);

    expect(result.retried).toBe(1);

    const [entry] = await list();

    expect(entry?.status).toBe("pending_sync");
    expect(entry?.attempts).toBe(1);
  });

  it("skips entries whose backoff window has not elapsed", async () => {
    const { enqueue, flush } = await loadOutbox();

    await enqueue("session", "session-6", SESSION_BODY);

    const failingFetch: typeof fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;

    const first = await flush(failingFetch);

    expect(first.retried).toBe(1);

    let replayCalls = 0;

    const countingFetch: typeof fetch = (async () => {
      replayCalls += 1;

      return okSessionResponse();
    }) as typeof fetch;

    const second = await flush(countingFetch);

    // The entry just failed, so its createdAt + attempts * 30s is in the
    // future; the immediate reflush must skip it rather than hammer the API.
    expect(replayCalls).toBe(0);
    expect(second.deferred).toBe(1);
    expect(second.sent).toBe(0);
  });
});

describe("subscribe", () => {
  it("notifies subscribers on enqueue and stops after unsubscribe", async () => {
    const { enqueue, subscribe } = await loadOutbox();

    const seen: number[] = [];

    const unsubscribe = subscribe((entries) => {
      seen.push(
        entries.filter((entry) => entry.status === "pending_sync").length,
      );
    });

    await enqueue("session", "session-7", SESSION_BODY);
    await enqueue("session", "session-8", SESSION_BODY);

    unsubscribe();

    await enqueue("session", "session-9", SESSION_BODY);

    expect(seen).toEqual([1, 2]);
  });
});

describe("clearAll", () => {
  it("empties both the outbox and the cache stores", async () => {
    const { clearAll, count, list, enqueue } = await loadOutbox();
    const { saveLastView, readLastView } =
      await import("@/lib/offline/checkin-cache");

    await enqueue("session", "session-10", SESSION_BODY);
    await saveLastView({
      meetings: [],
      identity: { fullName: null, nim: null },
      activeSessions: [],
      checkInState: { meetings: {}, sessions: {} },
    });

    await clearAll();

    expect(await count()).toBe(0);
    expect(await list()).toEqual([]);
    expect(await readLastView()).toBeNull();
  });
});

describe("remove", () => {
  it("deletes a single entry", async () => {
    const { count, enqueue, remove } = await loadOutbox();
    const entry = await enqueue("session", "session-11", SESSION_BODY);

    await remove(entry.id);

    expect(await count()).toBe(0);
  });
});

describe("count", () => {
  it("counts only pending_sync entries", async () => {
    const { count, enqueue, flush } = await loadOutbox();

    await enqueue("session", "session-12", SESSION_BODY);
    await enqueue("session", "session-13", SESSION_BODY);

    expect(await count()).toBe(2);

    const fetchImpl: typeof fetch = (async () =>
      okSessionResponse()) as typeof fetch;

    await flush(fetchImpl);

    expect(await count()).toBe(0);
  });
});

describe("stale syncing entries", () => {
  function forceSyncing(
    sessionId: string,
    status: "syncing" | "pending_sync",
    syncingAt: number,
  ): void {
    const record = harness.stores.get("checkin_outbox");

    if (!record) {
      throw new Error("checkin_outbox store missing");
    }

    for (const [key, value] of record.values) {
      const entry = value as { sessionId?: string; id: string };

      if (entry.sessionId === sessionId) {
        record.values.set(key, {
          ...(value as Record<string, unknown>),
          status,
          syncingAt,
        });
      }
    }
  }

  it("re-claims a stale syncing entry on the next flush", async () => {
    const { enqueue, flush, list } = await loadOutbox();

    await enqueue("session", "stale-1", SESSION_BODY);
    forceSyncing("stale-1", "syncing", Date.now() - 10 * 60_000);

    let replayCalls = 0;
    const fetchImpl: typeof fetch = (async () => {
      replayCalls += 1;

      return okSessionResponse();
    }) as typeof fetch;

    const result = await flush(fetchImpl);

    expect(replayCalls).toBe(1);
    expect(result.sent).toBe(1);

    const [entry] = await list();

    expect(entry?.status).toBe("sent");
  });

  it("does not re-claim a fresh syncing entry and counts it as pending", async () => {
    const { enqueue, flush, count } = await loadOutbox();

    await enqueue("session", "fresh-1", SESSION_BODY);
    forceSyncing("fresh-1", "syncing", Date.now());

    let replayCalls = 0;
    const fetchImpl: typeof fetch = (async () => {
      replayCalls += 1;

      return okSessionResponse();
    }) as typeof fetch;

    const result = await flush(fetchImpl);

    expect(replayCalls).toBe(0);
    expect(result.sent).toBe(0);
    expect(await count()).toBe(1);
  });
});
