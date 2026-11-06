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
  incr: (key: string) => Promise<number>;
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

  // `UPSTASH_REDIS_*` is the name actually configured in every environment
  // (rate limiting uses it too); `CACHE_REDIS_*` stays as an override for a
  // dedicated cache instance. Without this fallback the cache silently
  // misses on every read and all listing queries hit the database.
  const url =
    process.env.CACHE_REDIS_REST_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.CACHE_REDIS_REST_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

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

/**
 * Tag-based invalidation without key scans. Every tagged entry stores the
 * tag's generation counter in its key; bumping the counter orphans all old
 * entries, which then expire by TTL. Best effort: failure is ignored.
 */
function generationKey(tag: string): string {
  return `${CACHE_PREFIX}tag:${tag}:gen`;
}

async function currentGeneration(
  client: CacheClient,
  tag: string,
): Promise<number> {
  try {
    const gen = await withTimeout(client.get<number>(generationKey(tag)));

    return typeof gen === "number" ? gen : 0;
  } catch {
    return 0;
  }
}

/** Orphans every cached entry under `tag`. Call after a write that feeds it. */
export async function invalidateCacheTag(tag: string): Promise<void> {
  const client = getCacheClient();

  if (!client) {
    return;
  }

  try {
    await withTimeout(client.incr(generationKey(tag)));
  } catch {
    // Invalidation is best effort; stale entries expire by TTL anyway.
  }
}

/**
 * Like `getCached`, but entries are namespaced by `tag`'s generation so
 * `invalidateCacheTag` makes them miss immediately instead of lingering
 * until TTL.
 */
export async function getCachedWithTag<T>(
  tag: string,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const client = getCacheClient();

  if (!client) {
    return loader();
  }

  const generation = await currentGeneration(client, tag);
  const cacheKey = `${CACHE_PREFIX}${tag}:${key}:gen:${generation}`;

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

/** Tag for the per-user dashboard overview read. */
export const DASHBOARD_CACHE_TAG = "dashboard";

/** TTL for the per-user dashboard overview read. */
export const DASHBOARD_CACHE_TTL_SECONDS = DASHBOARD_TTL_SECONDS;

/** Tag for the public assignment listing reads. */
export const LISTING_CACHE_TAG = "listing";

/** TTL for global listing helpers (semesters, published counts). */
export const LISTING_CACHE_TTL_SECONDS = 60;

/** Tag for public assignment detail reads (published assignments only). */
export const ASSIGNMENT_DETAIL_CACHE_TAG = "assignment-detail";

/** TTL for public assignment detail reads. */
export const ASSIGNMENT_DETAIL_CACHE_TTL_SECONDS = 60;
