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

  delete(key: string): FakeRequest<undefined> {
    const request = new FakeRequest<undefined>();

    this.transaction.noteRequestStart();
    queueMicrotask(() => {
      if (this.harness.failNextRequests > 0) {
        this.harness.failNextRequests -= 1;
        this.fail(request, new Error("QuotaExceededError"));
        return;
      }

      this.record.values.delete(key);
      this.succeed(request, undefined);
    });

    return request;
  }

  getAll(): FakeRequest<unknown[]> {
    const request = new FakeRequest<unknown[]>();

    this.transaction.noteRequestStart();
    queueMicrotask(() => {
      const values = [...this.record.values.values()].map((value) =>
        structuredClone(value),
      );

      this.succeed(request, values);
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

beforeEach(() => {
  harness.stores.clear();
  harness.failNextRequests = 0;
  harness.version = 0;
  globalThis.indexedDB = harness.factory as unknown as IDBFactory;
});

afterEach(() => {
  if (originalIndexedDb === undefined) {
    // @ts-expect-error -- removing the global we replaced for these tests
    delete globalThis.indexedDB;
    return;
  }

  globalThis.indexedDB = originalIndexedDb;
});

const SAMPLE_VIEW = {
  meetings: [
    {
      sessionId: "meeting-1",
      classId: "class-1",
      classSlug: "bio",
      className: "Biology",
      classCode: null,
      courseName: "Biology",
      semester: "1",
      academicYear: "2026/2027",
      subjectId: null,
      subjectName: "Cells",
      subjectCode: null,
      meetingNumber: 1,
      meetingDate: "2026-11-10",
      title: "Kickoff",
      location: "Room 101",
      startsAt: "2026-11-10T01:00:00.000Z",
      endsAt: "2026-11-10T02:30:00.000Z",
      opensAt: null,
      closesAt: null,
      phase: "open" as const,
      radiusM: 100,
      lateAfterMinutes: 15,
      checkIn: null,
    },
  ],
  identity: { fullName: "Test Mahasiswa", nim: "123456789" },
  activeSessions: [
    {
      sessionId: "session-1",
      classId: "class-1",
      classSlug: "bio",
      className: "Biology",
      classCode: null,
      courseName: "Biology",
      semester: "1",
      subjectId: null,
      subjectName: "Cells",
      title: "Lab",
      organizerName: "Dr. Test",
      sessionType: "in_person" as const,
      location: "Room 101",
      startsAt: "2026-11-10T01:00:00.000Z",
      endsAt: "2026-11-10T02:30:00.000Z",
      timeZone: "Asia/Jakarta",
      radiusM: 100,
      checkIn: null,
    },
  ],
  checkInState: {
    meetings: {
      "meeting-1": {
        status: "present" as const,
        checkedInAt: "2026-11-10T01:05:00.000Z",
        distanceM: 12,
      },
    },
    sessions: {},
  },
};

async function loadCache() {
  return import("@/lib/offline/checkin-cache");
}

describe("save/read/clear roundtrip", () => {
  it("persists and reads back the exact view payload", async () => {
    const { saveLastView, readLastView } = await loadCache();

    await saveLastView(SAMPLE_VIEW);

    const stored = await readLastView();

    expect(stored).toEqual(SAMPLE_VIEW);
  });

  it("returns null when nothing has been saved yet", async () => {
    const { readLastView } = await loadCache();

    expect(await readLastView()).toBeNull();
  });

  it("clearLastView removes the record", async () => {
    const { saveLastView, readLastView, clearLastView } = await loadCache();

    await saveLastView(SAMPLE_VIEW);
    await clearLastView();

    expect(await readLastView()).toBeNull();
  });
});

describe("storage failure behaviour", () => {
  it("saveLastView fails silently instead of throwing", async () => {
    const { saveLastView, readLastView } = await loadCache();

    // First read attempt would happen on the `getAll` path; here the put
    // request itself must absorb the failure.
    harness.failNextRequests = 1;

    await expect(saveLastView(SAMPLE_VIEW)).resolves.toBeUndefined();

    // Nothing was persisted because the put rejected.
    expect(await readLastView()).toBeNull();
  });

  it("readLastView returns null when the store rejects", async () => {
    const { saveLastView, readLastView } = await loadCache();

    await saveLastView(SAMPLE_VIEW);

    harness.failNextRequests = 1;

    expect(await readLastView()).toBeNull();
  });

  it("clearLastView swallows storage errors", async () => {
    const { saveLastView, clearLastView, readLastView } = await loadCache();

    await saveLastView(SAMPLE_VIEW);

    harness.failNextRequests = 1;

    await expect(clearLastView()).resolves.toBeUndefined();

    // The record is still present because the delete rejected.
    expect(await readLastView()).not.toBeNull();
  });
});

describe("corruption handling", () => {
  it("returns null when the stored record is not a valid view", async () => {
    const { getCacheStore, requestToPromise } =
      await import("@/lib/offline/db");

    // Sanity-check the write path first so the assertion below cannot pass
    // for the wrong reason (e.g. store missing).
    await getCacheStore("readwrite", async (store) => {
      await requestToPromise(
        store.put({ key: "last-view", savedAt: 1, meetings: "nope" }),
      );
    });

    const { readLastView } = await loadCache();

    expect(await readLastView()).toBeNull();
  });
});
