import { ApiError } from "@/lib/api/errors";

export type CodeEntry = { status: number; code: string; message: string };

export const CODE_MAP: Record<string, CodeEntry> = {
  "42501": { status: 403, code: "forbidden", message: "Not allowed." },
  "22023": {
    status: 409,
    code: "invalid_state",
    message: "Not allowed in the current state.",
  },
  P0002: {
    status: 404,
    code: "profile_missing",
    message: "Your profile was not found.",
  },
};

// SQLSTATE -> ApiError; unknown codes log code only and surface as 500.
export function toAccountApiError(
  error: unknown,
  fallbackMessage: string,
): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const code = (error as { code?: string } | null | undefined)?.code;
  const mapped = code ? CODE_MAP[code] : undefined;

  if (mapped) {
    return new ApiError(mapped.status, mapped.code, mapped.message);
  }

  console.error("[account] unexpected database error", {
    code: code ?? "unknown",
  });

  return new ApiError(500, "internal_error", fallbackMessage);
}

export function requireSessionId(session: { user: { id: string } }): string {
  const id = session.user.id;

  if (!id) {
    throw new ApiError(401, "unauthorized", "Sign in to continue.");
  }

  return id;
}

export type RpcResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

// Verifies the jsonb payload from a lifecycle RPC and returns its fields.
export type LifecyclePayload = {
  status: string;
  deactivatedAt: string | null;
  deletedAt: string | null;
};

export function readLifecycleStatus(
  data: unknown,
  expected: "deactivated" | "active" | "deleted",
  fallbackMessage: string,
): LifecyclePayload {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  const pick = (k: string) =>
    typeof record[k] === "string" ? (record[k] as string) : null;
  const status = pick("status");
  const deactivatedAt = pick("deactivated_at");
  const deletedAt = pick("deleted_at");
  const requiredOk =
    expected === "deactivated"
      ? Boolean(deactivatedAt)
      : expected === "deleted"
        ? Boolean(deletedAt)
        : true;

  if (status !== expected || !requiredOk) {
    throw toAccountApiError({ code: "bad_rpc_payload" }, fallbackMessage);
  }

  return { status: status ?? expected, deactivatedAt, deletedAt };
}

// Logs the error's code only (never values) and returns the fallback.
export async function quietly<T>(
  label: string,
  fallback: T,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[account] ${label}`, {
      code: error instanceof Error ? error.name : "unknown",
    });

    return fallback;
  }
}
