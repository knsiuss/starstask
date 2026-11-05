import "server-only";

import { Redis } from "@upstash/redis";

/**
 * Short-lived read cache backed by Upstash Redis.
 *
 * The cache is strictly an optimization: every operation fails open, so a
 * Redis outage degrades to plain database reads instead of breaking the
 * product. Entries always carry a TTL, which keeps eviction from ever
 * dropping data that has no expiry.
 */

const CACHE_PREFIX = "starstask:cache:";
const DASHBOARD_TTL_SECONDS = 30;
const CACHE_IO_TIMEOUT_MS = 1000;

type CacheClient = {
  get: <T>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    options: { ex: number },
  ) => Promise<unknown>;
};

/** Resolves to `null` (miss) when the operation exceeds the timeout. */
async function withTimeout<T>(operation: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), CACHE_IO_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

let cacheClient: CacheClient | null | undefined;

function getCacheClient(): CacheClient | null {
  if (cacheClient !== undefined) {
    return cacheClient;
  }

  const url = process.env.CACHE_REDIS_REST_URL?.trim();
  const token = process.env.CACHE_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    cacheClient = null;
    return cacheClient;
  }

  cacheClient = new Redis({ url, token }) as CacheClient;
  return cacheClient;
}

/**
 * Returns the cached value for `key`, or loads it via `loader` and stores
 * it for `ttlSeconds`. Any cache-layer failure falls back to `loader`.
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const client = getCacheClient();

  if (!client) {
    return loader();
  }

  const cacheKey = `${CACHE_PREFIX}${key}`;

  try {
    const cached = (await withTimeout(client.get<T>(cacheKey))) ?? null;

    if (cached !== null) {
      return cached;
    }
  } catch {
    // Fall through to the loader; the cache must never break a read.
  }

  const value = await loader();

  try {
    await withTimeout(client.set(cacheKey, value, { ex: ttlSeconds }));
  } catch {
    // A failed write just means the next read loads again.
  }

  return value;
}

/** TTL for the per-user dashboard overview read. */
export const DASHBOARD_CACHE_TTL_SECONDS = DASHBOARD_TTL_SECONDS;

/** TTL for global listing helpers (semesters, published counts). */
export const LISTING_CACHE_TTL_SECONDS = 60;
