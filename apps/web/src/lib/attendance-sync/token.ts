import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ATTENDANCE_SYNC_TTL_MS = 15 * 60 * 1_000;

const TEST_FALLBACK_SECRET = "starstask-test-attendance-sync-secret";
const KEY_DERIVATION_CONTEXT = "starstask:attendance-sync:v1";

export type AttendanceSyncTokenPayload = {
  meetingId: string;
  classId: string;
  issuedBy: string;
  exp: number;
  nonce: string;
};

export type AttendanceSyncTokenInput = {
  meetingId: string;
  classId: string;
  issuedBy: string;
};

function resolveSigningKey(): Buffer {
  const configured =
    process.env.ATTENDANCE_SYNC_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const rawSecret =
    configured ||
    (process.env.NODE_ENV === "test" ? TEST_FALLBACK_SECRET : undefined);

  if (!rawSecret) {
    throw new Error(
      "ATTENDANCE_SYNC_SECRET or SUPABASE_SERVICE_ROLE_KEY must be configured.",
    );
  }

  return createHmac("sha256", rawSecret)
    .update(KEY_DERIVATION_CONTEXT)
    .digest();
}

function signEncodedPayload(encodedPayload: string, key: Buffer): string {
  return createHmac("sha256", key)
    .update(encodedPayload)
    .digest()
    .toString("base64url");
}

function isValidTokenPayload(
  value: unknown,
): value is AttendanceSyncTokenPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.meetingId === "string" &&
    candidate.meetingId.length > 0 &&
    typeof candidate.classId === "string" &&
    candidate.classId.length > 0 &&
    typeof candidate.issuedBy === "string" &&
    candidate.issuedBy.length > 0 &&
    typeof candidate.nonce === "string" &&
    candidate.nonce.length > 0 &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp)
  );
}

/**
 * Signs a stateless 15-minute HMAC-SHA256 sync token for the SIAKAD extension.
 */
export function signAttendanceSyncToken(
  input: AttendanceSyncTokenInput,
  nowMs: number = Date.now(),
): { code: string; expiresAt: string } {
  const key = resolveSigningKey();
  const exp = nowMs + ATTENDANCE_SYNC_TTL_MS;
  const payload: AttendanceSyncTokenPayload = {
    meetingId: input.meetingId,
    classId: input.classId,
    issuedBy: input.issuedBy,
    exp,
    nonce: randomBytes(12).toString("base64url"),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = signEncodedPayload(encodedPayload, key);

  return {
    code: `${encodedPayload}.${signature}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

/**
 * Verifies signature and expiry of a sync code. Returns null when invalid,
 * tampered, or expired.
 */
export function verifyAttendanceSyncToken(
  code: string,
  nowMs: number = Date.now(),
): AttendanceSyncTokenPayload | null {
  const trimmed = code.trim();
  const parts = trimmed.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, providedSignature] = parts;

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const key = resolveSigningKey();
  const expectedSignature = signEncodedPayload(encodedPayload, key);
  const providedBuf = Buffer.from(providedSignature, "utf8");
  const expectedBuf = Buffer.from(expectedSignature, "utf8");

  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return null;
  }

  let parsed: unknown;

  try {
    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    parsed = JSON.parse(json) as unknown;
  } catch {
    return null;
  }

  if (!isValidTokenPayload(parsed)) {
    return null;
  }

  if (parsed.exp <= nowMs) {
    return null;
  }

  return parsed;
}
