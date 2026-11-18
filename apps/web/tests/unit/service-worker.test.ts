import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

import {
  registerServiceWorker,
  SERVICE_WORKER_SCOPE,
  SERVICE_WORKER_URL,
  type ServiceWorkerContainerLike,
} from "@/lib/push/service-worker";

const SW_SOURCE = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);
const ORIGIN = "https://app.starstask.test";

function container(
  register: ServiceWorkerContainerLike["register"],
): ServiceWorkerContainerLike {
  return { register };
}

describe("registerServiceWorker", () => {
  it("registers the worker at the site root and always revalidates it", async () => {
    const registration = { scope: "/" } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);

    await expect(registerServiceWorker(container(register))).resolves.toBe(
      registration,
    );
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
      updateViaCache: "none",
    });
  });

  it("returns null when the browser has no service worker support", async () => {
    await expect(registerServiceWorker()).resolves.toBeNull();
  });

  it("swallows registration failures so the site keeps working", async () => {
    const register = vi.fn().mockRejectedValue(new Error("SecurityError"));

    await expect(
      registerServiceWorker(container(register)),
    ).resolves.toBeNull();
  });

  it("uses the documented worker path and scope", () => {
    expect(SERVICE_WORKER_URL).toBe("/sw.js");
    expect(SERVICE_WORKER_SCOPE).toBe("/");
  });
});

class FakeResponse {
  constructor(
    readonly body: string,
    readonly ok = true,
    readonly status = 200,
  ) {}

  clone(): FakeResponse {
    return new FakeResponse(this.body, this.ok, this.status);
  }
}

function cacheKey(input: string | FakeRequest): string {
  const raw = typeof input === "string" ? input : input.url;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      return new URL(raw).pathname;
    } catch {
      return raw;
    }
  }

  return raw;
}

class FakeCache {
  readonly items = new Map<string, FakeResponse>();

  async match(input: string | FakeRequest): Promise<FakeResponse | undefined> {
    return this.items.get(cacheKey(input));
  }

  async put(
    input: string | FakeRequest,
    response: FakeResponse,
  ): Promise<void> {
    this.items.set(cacheKey(input), response);
  }

  async addAll(urls: string[]): Promise<void> {
    for (const url of urls) {
      this.items.set(url, new FakeResponse(`precached:${url}`));
    }
  }
}

class FakeCacheStorage {
  readonly stores = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    const existing = this.stores.get(name);

    if (existing) {
      return existing;
    }

    const created = new FakeCache();
    this.stores.set(name, created);

    return created;
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }

  async match(input: string | FakeRequest): Promise<FakeResponse | undefined> {
    for (const store of this.stores.values()) {
      const found = await store.match(input);

      if (found) {
        return found;
      }
    }

    return undefined;
  }
}

class FakeRequest {
  constructor(
    readonly method: string,
    readonly url: string,
    readonly mode: string = "cors",
  ) {}
}

class FakeWindowClient {
  readonly messages: unknown[] = [];

  constructor(readonly url: string = `${ORIGIN}/attendance`) {}

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  async focus(): Promise<this> {
    return this;
  }

  async navigate(): Promise<this> {
    return this;
  }
}

type ListenerMap = Map<string, Array<(event: unknown) => void>>;

type SwHarness = {
  listeners: ListenerMap;
  storage: FakeCacheStorage;
  fetchMock: ReturnType<
    typeof vi.fn<(request: FakeRequest) => Promise<FakeResponse>>
  >;
  clients: FakeWindowClient[];
  skipWaiting: ReturnType<typeof vi.fn<() => void>>;
  claim: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

function loadServiceWorker(): SwHarness {
  const listeners: ListenerMap = new Map();
  const storage = new FakeCacheStorage();
  const clients = [new FakeWindowClient(), new FakeWindowClient()];
  const fetchMock = vi.fn<(request: FakeRequest) => Promise<FakeResponse>>();
  const skipWaiting = vi.fn<() => void>();
  const claim = vi.fn<() => Promise<void>>(() => Promise.resolve());

  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    skipWaiting,
    clients: {
      claim,
      matchAll: <T>(_options?: T) => Promise.resolve(clients),
      openWindow: vi.fn(() => Promise.resolve(clients[0])),
    },
    location: { origin: ORIGIN },
  };

  const sandbox = {
    self,
    caches: storage,
    fetch: fetchMock,
    URL,
  };

  vm.createContext(sandbox);
  vm.runInContext(SW_SOURCE, sandbox, { filename: "sw.js" });

  return { listeners, storage, fetchMock, clients, skipWaiting, claim };
}

function dispatch(harness: SwHarness, type: string, event: unknown): void {
  for (const listener of harness.listeners.get(type) ?? []) {
    listener(event);
  }
}

function collectWaitUntil(): {
  event: { waitUntil: (promise: Promise<unknown>) => void };
  drain: () => Promise<void>;
} {
  const pending: Promise<unknown>[] = [];
  const event = {
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(Promise.resolve(promise));
    },
  };

  return {
    event,
    drain: () => Promise.all(pending).then(() => undefined),
  };
}

function makeFetchEvent(request: FakeRequest): {
  event: {
    request: FakeRequest;
    respondWith: (
      response: Promise<FakeResponse | undefined> | FakeResponse | undefined,
    ) => void;
  };
  response: () => Promise<FakeResponse | undefined> | undefined;
} {
  let captured: Promise<FakeResponse | undefined> | undefined;

  const event = {
    request,
    respondWith: (
      response: Promise<FakeResponse | undefined> | FakeResponse | undefined,
    ) => {
      captured = Promise.resolve(response);
    },
  };

  return { event, response: () => captured };
}

function makeSyncEvent(tag: string) {
  const { event, drain } = collectWaitUntil();

  return {
    event: Object.assign(event, { tag }),
    drain,
  };
}

async function runFetch(
  harness: SwHarness,
  request: FakeRequest,
): Promise<FakeResponse | undefined> {
  const { event, response } = makeFetchEvent(request);

  dispatch(harness, "fetch", event);

  return response();
}

async function withInstalledSw(): Promise<SwHarness> {
  const harness = loadServiceWorker();
  const { event, drain } = collectWaitUntil();

  dispatch(harness, "install", event);
  await drain();

  return harness;
}

describe("service worker offline shell", () => {
  it("precaches exactly the documented literals and skips waiting", async () => {
    const harness = loadServiceWorker();
    const { event, drain } = collectWaitUntil();

    dispatch(harness, "install", event);
    await drain();

    expect(harness.skipWaiting).toHaveBeenCalledTimes(1);

    const precached = await harness.storage.open("starstask-offline-static-v1");
    const keys = [...precached.items.keys()].sort();

    expect(keys).toEqual(
      [
        "/offline",
        "/icons/badge-96.png",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/icon-maskable-512.png",
      ].sort(),
    );
  });

  it("deletes other offline namespaces on activate and keeps foreign caches", async () => {
    const harness = loadServiceWorker();

    await harness.storage.open("starstask-offline-static-v0");
    await harness.storage.open("starstask-offline-static-v1");
    await harness.storage.open("unrelated-cache");

    const { event, drain } = collectWaitUntil();

    dispatch(harness, "activate", event);
    await drain();

    expect(harness.claim).toHaveBeenCalledTimes(1);

    const remaining = await harness.storage.keys();

    expect(remaining).not.toContain("starstask-offline-static-v0");
    expect(remaining).toContain("starstask-offline-static-v1");
    expect(remaining).toContain("unrelated-cache");
  });

  it("serves cached icons cache-first without hitting the network", async () => {
    const harness = await withInstalledSw();

    harness.fetchMock.mockRejectedValue(new TypeError("network down"));

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/icons/icon-192.png`),
    );

    expect(response?.body).toBe("precached:/icons/icon-192.png");
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("populates the cache for /_next/static assets on first miss", async () => {
    const harness = await withInstalledSw();

    harness.fetchMock.mockResolvedValue(new FakeResponse("chunk-body"));

    const first = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/_next/static/chunks/app.js`),
    );

    expect(first?.body).toBe("chunk-body");

    const cache = await harness.storage.open("starstask-offline-static-v1");
    const stored = await cache.match("/_next/static/chunks/app.js");

    expect(stored?.body).toBe("chunk-body");
  });

  it("serves /_next/static assets cache-first once populated", async () => {
    const harness = await withInstalledSw();

    harness.fetchMock.mockResolvedValue(new FakeResponse("chunk-body"));

    await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/_next/static/chunks/app.js`),
    );
    harness.fetchMock.mockClear();

    const second = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/_next/static/chunks/app.js`),
    );

    expect(second?.body).toBe("chunk-body");
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("serves /offline from the precache", async () => {
    const harness = await withInstalledSw();

    harness.fetchMock.mockRejectedValue(new TypeError("network down"));

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/offline`),
    );

    expect(response?.body).toBe("precached:/offline");
  });

  it("uses network-first for /attendance navigations and falls back to /offline when the network fails", async () => {
    const harness = await withInstalledSw();

    harness.fetchMock.mockRejectedValue(new TypeError("network down"));

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/attendance`, "navigate"),
    );

    expect(response?.body).toBe("precached:/offline");
  });

  it("uses network-first for /attendance/checkin/* navigations", async () => {
    const harness = await withInstalledSw();

    harness.fetchMock.mockResolvedValue(new FakeResponse("live-page"));

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/attendance/checkin/abc123`, "navigate"),
    );

    expect(response?.body).toBe("live-page");

    // Nothing about the authenticated page was cached.
    const cache = await harness.storage.open("starstask-offline-static-v1");
    const cached = await cache.match("/attendance/checkin/abc123");

    expect(cached).toBeUndefined();
  });

  it("falls back to /offline for a failed /attendance/checkin/* navigation", async () => {
    const harness = await withInstalledSw();

    harness.fetchMock.mockRejectedValue(new TypeError("network down"));

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/attendance/checkin/abc123`, "navigate"),
    );

    expect(response?.body).toBe("precached:/offline");
  });

  it("does not intercept /api/* GET requests", async () => {
    const harness = await withInstalledSw();

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/api/attendance/meetings/123/checkin`),
    );

    expect(response).toBeUndefined();
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("does not intercept RSC payload requests", async () => {
    const harness = await withInstalledSw();

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/attendance?_rsc=abc123`, "navigate"),
    );

    expect(response).toBeUndefined();
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("does not intercept Next data routes", async () => {
    const harness = await withInstalledSw();

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/_next/data/build-id/attendance.json`),
    );

    expect(response).toBeUndefined();
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("does not intercept non-GET requests", async () => {
    const harness = await withInstalledSw();

    const response = await runFetch(
      harness,
      new FakeRequest("POST", `${ORIGIN}/_next/static/chunks/app.js`),
    );

    expect(response).toBeUndefined();
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("does not intercept cross-origin requests", async () => {
    const harness = await withInstalledSw();

    const response = await runFetch(
      harness,
      new FakeRequest("GET", "https://cdn.example.com/icons/icon-192.png"),
    );

    expect(response).toBeUndefined();
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("does not cache an unlisted same-origin path", async () => {
    const harness = await withInstalledSw();

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/dashboard`),
    );

    expect(response).toBeUndefined();
    expect(harness.fetchMock).not.toHaveBeenCalled();

    const cache = await harness.storage.open("starstask-offline-static-v1");
    const cached = await cache.match("/dashboard");

    expect(cached).toBeUndefined();
  });

  it("does not intercept subresource requests for /attendance (only navigations)", async () => {
    const harness = await withInstalledSw();

    const response = await runFetch(
      harness,
      new FakeRequest("GET", `${ORIGIN}/attendance`),
    );

    expect(response).toBeUndefined();
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("relays checkin-outbox sync events to window clients without fetching", async () => {
    const harness = await withInstalledSw();
    const { event, drain } = makeSyncEvent("checkin-outbox");

    dispatch(harness, "sync", event);
    await drain();

    for (const client of harness.clients) {
      expect(client.messages).toEqual([{ type: "FLUSH_OUTBOX" }]);
    }

    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("ignores sync events for other tags", async () => {
    const harness = await withInstalledSw();
    const { event, drain } = makeSyncEvent("something-else");

    dispatch(harness, "sync", event);
    await drain();

    for (const client of harness.clients) {
      expect(client.messages).toEqual([]);
    }
  });

  it("CLEAR_OFFLINE_STORAGE deletes offline caches and notifies open windows", async () => {
    const harness = await withInstalledSw();

    await harness.storage.open("starstask-offline-static-v1");
    await harness.storage.open("starstask-offline-drafts-v1");
    await harness.storage.open("unrelated-cache");

    const { event, drain } = collectWaitUntil();

    dispatch(
      harness,
      "message",
      Object.assign(event, {
        data: { type: "CLEAR_OFFLINE_STORAGE" },
      }),
    );
    await drain();

    const remaining = await harness.storage.keys();

    expect(remaining).not.toContain("starstask-offline-static-v1");
    expect(remaining).not.toContain("starstask-offline-drafts-v1");
    expect(remaining).toContain("unrelated-cache");

    for (const client of harness.clients) {
      expect(client.messages).toEqual([{ type: "CLEAR_OFFLINE_STORAGE" }]);
    }
  });

  it("FLUSH_OUTBOX messages relay to all window clients", async () => {
    const harness = await withInstalledSw();
    const { event, drain } = collectWaitUntil();

    dispatch(
      harness,
      "message",
      Object.assign(event, {
        data: { type: "FLUSH_OUTBOX" },
      }),
    );
    await drain();

    for (const client of harness.clients) {
      expect(client.messages).toEqual([{ type: "FLUSH_OUTBOX" }]);
    }

    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("ignores malformed message payloads", async () => {
    const harness = await withInstalledSw();
    const { event, drain } = collectWaitUntil();

    dispatch(harness, "message", Object.assign(event, { data: null }));
    dispatch(harness, "message", Object.assign(event, { data: "text" }));
    dispatch(
      harness,
      "message",
      Object.assign(event, {
        data: { type: 42 },
      }),
    );
    await drain();

    for (const client of harness.clients) {
      expect(client.messages).toEqual([]);
    }
  });
});
