import "server-only";

import { ApiError } from "@/lib/api/errors";

/**
 * Postgres error codes raised by the session functions.
 *
 * `SS001`–`SS003` are the domain codes the RSVP function raises for a full
 * session, a closed registration window, and a session that is no longer
 * scheduled. Mapping them here keeps the API response stable even if the SQL
 * message changes.
 */
const CODE_MAP: Record<
  string,
  { status: number; code: string; message: string }
> = {
  "42501": {
    status: 403,
    code: "forbidden",
    message: "You do not have permission to perform this action.",
  },
  P0002: {
    status: 404,
    code: "not_found",
    message: "The requested session was not found.",
  },
  "22023": {
    status: 400,
    code: "invalid_state",
    message: "This action is not allowed in the current state.",
  },
  SS001: {
    status: 409,
    code: "session_full",
    message: "This session is full.",
  },
  SS002: {
    status: 409,
    code: "registration_closed",
    message: "Registration for this session is closed.",
  },
  SS003: {
    status: 409,
    code: "not_scheduled",
    message: "This session is no longer open for registration.",
  },
  SS101: {
    status: 409,
    code: "checkin_unavailable",
    message: "Check-in is not available for this session.",
  },
  SS102: {
    status: 409,
    code: "checkin_not_open",
    message: "Check-in has not opened yet.",
  },
  SS103: {
    status: 409,
    code: "checkin_closed",
    message: "Check-in is closed.",
  },
  SS104: {
    status: 422,
    code: "checkin_imprecise",
    message:
      "Location accuracy is too weak. Move somewhere with a clearer signal and try again.",
  },
  SS105: {
    status: 422,
    code: "checkin_too_far",
    message: "You are outside the check-in radius.",
  },
  SS107: {
    status: 409,
    code: "checkin_not_scheduled",
    message: "This session is not open for check-in.",
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

export function toSessionApiError(
  error: unknown,
  fallbackMessage: string,
): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const postgres = error as PostgresError;
  const mapped = postgres?.code ? CODE_MAP[postgres.code] : undefined;

  if (mapped) {
    return new ApiError(mapped.status, mapped.code, mapped.message);
  }

  console.error("[sessions] unexpected database error", {
    code: postgres?.code ?? "unknown",
    name: error instanceof Error ? error.name : typeof error,
  });

  return new ApiError(500, "internal_error", fallbackMessage);
}
