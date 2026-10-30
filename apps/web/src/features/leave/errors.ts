import "server-only";

import { ApiError } from "@/lib/api/errors";

/**
 * Postgres error codes raised by the leave functions.
 *
 * `SS011`–`SS015` are the domain codes the SQL raises for an immutable request,
 * an invalid transition, an ineligible selection, incomplete data, and a
 * malformed selection. Mapping them here keeps the HTTP contract stable even if
 * a SQL message is reworded.
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
    message: "The requested absence request was not found.",
  },
  "22023": {
    status: 400,
    code: "invalid_input",
    message: "One or more values are not valid.",
  },
  SS011: {
    status: 409,
    code: "not_editable",
    message: "This request can no longer be edited.",
  },
  SS012: {
    status: 409,
    code: "invalid_transition",
    message: "That action is not allowed in the request's current state.",
  },
  SS013: {
    status: 409,
    code: "not_eligible",
    message:
      "Every selected request must belong to this class and be awaiting forwarding.",
  },
  SS014: {
    status: 422,
    code: "incomplete",
    message: "The request is incomplete or has no evidence attached.",
  },
  SS015: {
    status: 409,
    code: "invalid_selection",
    message: "The selection is invalid.",
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

export function toLeaveApiError(
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

  // Only the code and the error class are logged: the SQL message can echo a
  // row value, and a leave row holds medical information.
  console.error("[leave] unexpected database error", {
    code: postgres?.code ?? "unknown",
    name: error instanceof Error ? error.name : typeof error,
  });

  return new ApiError(500, "internal_error", fallbackMessage);
}
