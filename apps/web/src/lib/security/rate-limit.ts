import "server-only";

import { createHash } from "node:crypto";

import {
  ApiError,
  serviceUnavailable,
  tooManyRequests,
} from "@/lib/api/errors";
import { isSupabaseConfigured } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RateLimitFailureMode = "open" | "closed";

export type RateLimitRule = {
  action: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
  /**
   * How to behave when the counter backend is unreachable. Reads default to
   * "open" so a limiter outage does not take the product down. Expensive writes
   * pass "closed" so an outage cannot remove their only abuse control.
   */
  onBackendFailure?: RateLimitFailureMode;
};

type MemoryBucket = { hits: number; windowStartedAt: number };

type UpstashLimiter = {
  limit: (key: string) => Promise<{ success: boolean }>;
};

const DEVELOPMENT_SALT = "starstask-development-salt";
const UNKNOWN_IDENTIFIER = "unknown";

const memoryBuckets = new Map<string, MemoryBucket>();
const upstashLimiters = new Map<string, Promise<UpstashLimiter>>();
const warnedMissingIdentifier = new Set<string>();

function resolveSalt(): string {
  const salt = process.env.RATE_LIMIT_SALT?.trim();

  if (salt) {
    return salt;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_SALT must be configured in production.");
  }

  return DEVELOPMENT_SALT;
}

function hashIdentifier(action: string, identifier: string): string {
  return createHash("sha256")
    .update(`${resolveSalt()}:${action}:${identifier}`)
    .digest("hex")
    .slice(0, 40);
}

function hasUpstashConfig(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

/**
 * Consumes one unit from a fixed window.
 *
 * Order of preference:
 * 1. Upstash Redis (set `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`).
 * 2. Postgres counter through `consume_rate_limit` — distributed, no extra key.
 * 3. In-process memory (local development only; not safe on serverless).
 *
 * @throws {ApiError} 429 when the rule is exhausted, 503 when the backend fails
 * and the rule is marked `onBackendFailure: "closed"`.
 */
export async function enforceRateLimit(rule: RateLimitRule): Promise<void> {
  if (rule.identifier === UNKNOWN_IDENTIFIER) {
    if (
      process.env.NODE_ENV === "production" &&
      rule.onBackendFailure === "closed"
    ) {
      // No trustworthy identifier means the limit cannot be enforced; for
      // auth/expensive actions a silent skip would remove the only control.
      throw serviceUnavailable();
    }
    warnMissingIdentifier(rule.action);
    return;
  }

  const key = hashIdentifier(rule.action, rule.identifier);

  try {
    if (hasUpstashConfig()) {
      const limiter = await getUpstashLimiter(rule.limit, rule.windowSeconds);
      const result = await limiter.limit(key);

      if (!result.success) {
        throw tooManyRequests(rule.windowSeconds);
      }

      return;
    }

    if (isSupabaseConfigured()) {
      if (!(await consumePostgres(rule, key))) {
        throw tooManyRequests(rule.windowSeconds);
      }

      return;
    }

    if (!consumeMemory(key, rule.limit, rule.windowSeconds)) {
      throw tooManyRequests(rule.windowSeconds);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("[rate-limit] counter backend failed", {
      action: rule.action,
      name: error instanceof Error ? error.name : typeof error,
    });

    if (rule.onBackendFailure === "closed") {
      throw serviceUnavailable();
    }
  }
}

function warnMissingIdentifier(action: string): void {
  if (warnedMissingIdentifier.has(action)) {
    return;
  }

  warnedMissingIdentifier.add(action);
  console.warn("[rate-limit] no trustworthy client identifier; skipping", {
    action,
  });
}

function getUpstashLimiter(
  limit: number,
  windowSeconds: number,
): Promise<UpstashLimiter> {
  const cacheKey = `${limit}:${windowSeconds}`;
  const cached = upstashLimiters.get(cacheKey);

  if (cached) {
    return cached;
  }

  const created = (async (): Promise<UpstashLimiter> => {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import("@upstash/ratelimit"),
      import("@upstash/redis"),
    ]);

    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.fixedWindow(limit, `${windowSeconds} s`),
      prefix: "starstask:rl",
    });
  })();

  upstashLimiters.set(cacheKey, created);
  void created.catch(() => {
    upstashLimiters.delete(cacheKey);
  });

  return created;
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
    // The message may contain SQL details, so only the code is kept.
    throw new Error(`rate limit counter error: ${error.code ?? "unknown"}`);
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

function trustsCloudflareHeaders(): boolean {
  return (
    process.env.CF_PAGES === "1" ||
    process.env.CF_PAGES === "true" ||
    process.env.CLOUDFLARE === "1" ||
    process.env.CLOUDFLARE === "true" ||
    process.env.TRUST_PROXY_HEADERS === "true"
  );
}

function trustsVercelHeaders(): boolean {
  return process.env.VERCEL === "1";
}

function trustsForwardedHeaders(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.TRUST_X_FORWARDED_FOR === "true" ||
    process.env.TRUST_PROXY_HEADERS === "true"
  );
}

function validIpCandidate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed && trimmed !== UNKNOWN_IDENTIFIER ? trimmed : null;
}

/**
 * Best-effort client IP for rate limiting only; never used for authorization.
 *
 * Platform-overwritten single-IP headers (`cf-connecting-ip` on Cloudflare,
 * `x-vercel-forwarded-for` on Vercel) take priority when their platform is
 * active so a spoofed `x-forwarded-for` cannot override them.
 */
export function getClientIdentifier(request: Request): string {
  if (trustsCloudflareHeaders()) {
    const cfIp = validIpCandidate(request.headers.get("cf-connecting-ip"));

    if (cfIp) {
      return cfIp;
    }
  }

  if (trustsVercelHeaders()) {
    const vercelIp = validIpCandidate(
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0],
    );

    if (vercelIp) {
      return vercelIp;
    }
  }

  if (!trustsForwardedHeaders()) {
    return UNKNOWN_IDENTIFIER;
  }

  const realIp = validIpCandidate(request.headers.get("x-real-ip"));

  if (realIp) {
    return realIp;
  }

  const forwardedFirst = validIpCandidate(
    request.headers.get("x-forwarded-for")?.split(",")[0],
  );

  if (forwardedFirst) {
    return forwardedFirst;
  }

  return UNKNOWN_IDENTIFIER;
}
