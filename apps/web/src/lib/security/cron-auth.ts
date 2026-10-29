import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Validates the scheduler's bearer token.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. A missing secret
 * disables the endpoint entirely rather than leaving it open, and the compare
 * is timing-safe so the token cannot be guessed byte by byte.
 */
export function isAuthorizedCronRequest(
  request: Request,
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(header.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(secret, "utf8");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
