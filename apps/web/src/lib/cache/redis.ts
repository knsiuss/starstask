"server-only";

import { Redis } from "@upstash/redis";

/**
 * Cache layer (Upstash Redis, TTL pendek).
 * - Dashboard overview: 45s
 * - University info / plugin events: 60s
 * - Class list: 30s
 * Invalidate: on write (assignment create, attendance open, dll) via delete tag.
 * Fallback: memory cache kalau Redis belum dikonfigurasi (dev).
 */

export const CACHE_TTL = {
  DASHBOARD: 45,
  UNIVERSITY_INFO: 60,
  CLASS_LIST: 30,
  PLUGIN_EVENTS: 60,
} as const;

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redis = null;
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

const memory = new Map<string, { value: unknown; expires: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (r) {
    return (await r.get(key)) as T | null;
  }
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  return null;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(key, value, { ex: ttlSeconds });
    return;
  }
  memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

export async function cacheInvalidate(prefix: string): Promise<void> {
  const r = getRedis();
  if (r) {
    // Redis SCAN prefix — best effort, TTL akan expired sendiri
    const keys = await r.keys(`${prefix}*`);
    if (keys.length > 0) await r.del(...keys);
    return;
  }
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

export function dashboardKey(userId: string): string {
  return `dashboard:${userId}`;
}

export function classListKey(universityId: string): string {
  return `classes:${universityId}`;
}
