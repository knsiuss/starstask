import "server-only";

import { ApiError } from "@/lib/api/errors";

/**
 * Postgres error codes raised by the class workflow functions.
 *
 * The functions raise short, user-safe messages, so the mapping keeps those
 * and never forwards an unexpected provider message.
 */
const CODE_MAP: Record<string, { status: number; code: string; message: string }> =
  {
    "42501": {
      status: 403,
      code: "forbidden",
      message: "You do not have permission to perform this action.",
    },
    P0002: {
      status: 404,
      code: "not_found",
      message: "The requested record was not found.",
    },
    "22023": {
      status: 400,
      code: "invalid_state",
      message: "This action is not allowed in the current state.",
    },
    "23505": {
      status: 409,
      code: "conflict",
      message: "That record already exists.",
    },
    "23503": {
      status: 400,
      code: "invalid_reference",
      message: "The referenced record does not exist.",
    },
    "23514": {
      status: 400,
      code: "invalid_input",
      message: "One or more values are not allowed.",
    },
  };

type PostgresError = { code?: string; message?: string; details?: string };

/**
 * Converts a data-access failure into an `ApiError` with a stable code.
 *
 * Known SQLSTATE codes get a fixed, safe message. Anything else is logged with
 * its code only and reported as a generic failure, so a raw database message
 * never reaches the browser.
 */
export function toClassApiError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const postgres = error as PostgresError;
  const mapped = postgres?.code ? CODE_MAP[postgres.code] : undefined;

  if (mapped) {
    return new ApiError(mapped.status, mapped.code, mapped.message);
  }

  console.error("[classes] unexpected database error", {
    code: postgres?.code ?? "unknown",
    name: error instanceof Error ? error.name : typeof error,
  });

  return new ApiError(500, "internal_error", fallbackMessage);
}
