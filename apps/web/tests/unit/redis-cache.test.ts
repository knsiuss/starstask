import { afterEach, describe, expect, it, vi } from "vitest";

const originalCacheUrl = process.env.CACHE_REDIS_REST_URL;
const originalCacheToken = process.env.CACHE_REDIS_REST_TOKEN;

afterEach(() => {
  if (originalCacheUrl === undefined) {
    delete process.env.CACHE_REDIS_REST_URL;
  } else {
    process.env.CACHE_REDIS_REST_URL = originalCacheUrl;
  }

  if (originalCacheToken === undefined) {
    delete process.env.CACHE_REDIS_REST_TOKEN;
  } else {
    process.env.CACHE_REDIS_REST_TOKEN = originalCacheToken;
  }

  vi.resetModules();
});

describe("getCached", () => {
  it("loads from the loader when no cache is configured", async () => {
    delete process.env.CACHE_REDIS_REST_URL;
    delete process.env.CACHE_REDIS_REST_TOKEN;

    const { getCached: uncachedGetCached } =
      await import("@/lib/cache/redis-cache");
    const loader = vi.fn(async () => ({ marker: "loaded" }));

    await expect(uncachedGetCached("test:key", 30, loader)).resolves.toEqual({
      marker: "loaded",
    });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("falls back to the loader when the cache backend is unreachable", async () => {
    process.env.CACHE_REDIS_REST_URL = "https://invalid.upstash.invalid";
    process.env.CACHE_REDIS_REST_TOKEN = "invalid-token-for-test-only";

    const { getCached: failingGetCached } =
      await import("@/lib/cache/redis-cache");
    const loader = vi.fn(async () => ({ marker: "from-db" }));

    await expect(
      failingGetCached("test:unreachable", 30, loader),
    ).resolves.toEqual({ marker: "from-db" });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("propagates loader errors instead of swallowing them", async () => {
    delete process.env.CACHE_REDIS_REST_URL;
    delete process.env.CACHE_REDIS_REST_TOKEN;

    const { getCached: uncachedGetCached } =
      await import("@/lib/cache/redis-cache");

    await expect(
      uncachedGetCached("test:error", 30, async () => {
        throw new Error("database is down");
      }),
    ).rejects.toThrow("database is down");
  });
});
