import "server-only";

import { createHash } from "node:crypto";

import { tooManyRequests } from "@/lib/api/errors";
import { isSupabaseConfigured } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RateLimitRule = {
  action: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

type MemoryBucket = { hits: number; windowStartedAt: number };

const memoryBuckets = new Map<string, MemoryBucket>();

function hashIdentifier(action: string, identifier: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "starstask-development-salt";

  return createHash("sha256")
    .update(`${salt}:${action}:${identifier}`)
    .digest("hex")
    .slice(0, 40);
}

/**
 * Consumes one unit from a fixed window.
 *
 * Order of preference:
 * 1. Upstash Redis (set `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`).
 * 2. Postgres counter through `consume_rate_limit` — distributed, no extra key.
 * 3. In-process memory (local development only; not safe on serverless).
 *
 * @throws {ApiError} 429 when the rule is exhausted.
 */
export async function enforceRateLimit(rule: RateLimitRule): Promise<void> {
  const key = hashIdentifier(rule.action, rule.identifier);

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const allowed = await consumeUpstash(rule, key);

    if (!allowed) {
      throw tooManyRequests(rule.windowSeconds);
    }

    return;
  }

  if (isSupabaseConfigured()) {
    const allowed = await consumePostgres(rule, key);

    if (!allowed) {
      throw tooManyRequests(rule.windowSeconds);
    }

    return;
  }

  if (!consumeMemory(key, rule.limit, rule.windowSeconds)) {
    throw tooManyRequests(rule.windowSeconds);
  }
}

async function consumeUpstash(
  rule: RateLimitRule,
  key: string,
): Promise<boolean> {
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ]);

  const redis = Redis.fromEnv();
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(rule.limit, `${rule.windowSeconds} s`),
    prefix: "starstask:rl",
  });

  const result = await limiter.limit(key);

  return result.success;
}

async function consumePostgres(
  rule: RateLimitRule,
  key: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });

  if (error) {
    // Fail open on limiter outages: availability of the product is preferred
    // over blocking every write. The error is logged for alerting.
    console.error("[rate-limit] counter unavailable", { code: error.code });
    return true;
  }

  return data === true;
}

function consumeMemory(
  key: string,
  limit: number,
  windowSeconds: number,
): boolean {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || now - bucket.windowStartedAt >= windowSeconds * 1000) {
    memoryBuckets.set(key, { hits: 1, windowStartedAt: now });

    if (memoryBuckets.size > 5_000) {
      for (const [bucketKey, value] of memoryBuckets) {
        if (now - value.windowStartedAt > windowSeconds * 1000) {
          memoryBuckets.delete(bucketKey);
        }
      }
    }

    return true;
  }

  bucket.hits += 1;

  return bucket.hits <= limit;
}

/** Best-effort client IP for rate limiting only; never used for authorization. */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();

    if (first) {
      return first;
    }
  }

  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
