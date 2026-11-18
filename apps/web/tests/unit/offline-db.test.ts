import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Hand-written in-test IndexedDB stub (no new dependencies, per the milestone
 * spec). The fake is synchronous-in-behaviour but asynchronous in dispatch:
 * results are delivered in microtasks so callers can attach handlers after
 * the store method returns, mirroring real IndexedDB.
 */

type StoreRecord = {
  keyPath: string;
  values: Map<string, unknown>;
};

function keyOf(record: StoreRecord, value: unknown): string {
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
    // Covers transactions that never issue a request.
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
      const key = keyOf(this.record, value);

      if (this.record.values.has(key)) {
        this.fail(request, new Error("ConstraintError"));
        return;
      }

      this.record.values.set(key, value);
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

      const key = keyOf(this.record, value);

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
        request.result = database;
        // Real IndexedDB derives store names from the upgrade callback.
        this.version = version;
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
  installFakeIndexedDb();
});

function installFakeIndexedDb(): void {
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

afterEach(() => {
  uninstallFakeIndexedDb();
});

describe("offline db", () => {
  it("creates both object stores on first open", async () => {
    const { getOutboxStore, getCacheStore } = await import("@/lib/offline/db");

    await getOutboxStore("readonly", async (store) => {
      expect(store).toBeDefined();
    });
    await getCacheStore("readonly", async (store) => {
      expect(store).toBeDefined();
    });
  });

  it("keeps data across separate open/close cycles", async () => {
    const { getOutboxStore, requestToPromise } =
      await import("@/lib/offline/db");

    await getOutboxStore("readwrite", async (store) => {
      await requestToPromise(
        store.put({
          id: "entry-1",
          kind: "session",
          endpoint: "/api/sessions/[id]/checkin",
          sessionId: "session-1",
          body: { latitude: 0, longitude: 0, accuracy: 10 },
          capturedAt: 100,
          status: "pending_sync",
          attempts: 0,
          lastError: null,
          createdAt: 100,
        }),
      );
    });

    const stored = await getOutboxStore("readonly", async (store) => {
      return requestToPromise(store.get("entry-1"));
    });

    expect(stored).toMatchObject({ id: "entry-1" });
  });

  it("rejects requestToPromise when the request fails", async () => {
    const { getOutboxStore, requestToPromise } =
      await import("@/lib/offline/db");

    harness.failNextRequests = 1;

    await expect(
      getOutboxStore("readonly", async (store) => {
        return requestToPromise(store.get("missing"));
      }),
    ).rejects.toThrow("QuotaExceededError");
  });

  it("clearOfflineStores empties both stores", async () => {
    const {
      clearOfflineStores,
      getCacheStore,
      getOutboxStore,
      requestToPromise,
    } = await import("@/lib/offline/db");

    await getOutboxStore("readwrite", async (store) => {
      await requestToPromise(
        store.put({
          id: "entry-2",
          kind: "session",
          endpoint: "/api/sessions/[id]/checkin",
          sessionId: "session-2",
          body: { latitude: 0, longitude: 0, accuracy: 10 },
          capturedAt: 100,
          status: "pending_sync",
          attempts: 0,
          lastError: null,
          createdAt: 100,
        }),
      );
    });
    await getCacheStore("readwrite", async (store) => {
      await requestToPromise(store.put({ key: "last-view", savedAt: 100 }));
    });

    await clearOfflineStores();

    const outboxCount = await getOutboxStore("readonly", async (store) => {
      const values = await requestToPromise(store.getAll());

      return values.length;
    });
    const cacheCount = await getCacheStore("readonly", async (store) => {
      const values = await requestToPromise(store.getAll());

      return values.length;
    });

    expect(outboxCount).toBe(0);
    expect(cacheCount).toBe(0);
  });
});
