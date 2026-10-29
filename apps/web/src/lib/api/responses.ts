import "server-only";

import { ApiError } from "@/lib/api/errors";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
  };
};

export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json(
    { data },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/** Public, non-user-specific payload; safe for a short shared cache. */
export function publicJson<T>(data: T, maxAgeSeconds = 60): Response {
  return Response.json(
    { data },
    {
      status: 200,
      headers: {
        "Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=300`,
      },
    },
  );
}

export function apiError(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
  };

  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Converts thrown errors into a safe HTTP response. Unexpected errors are
 * logged without tokens, cookies, or request bodies, and the client only sees a
 * generic message.
 */
export function handleRouteError(error: unknown): Response {
  if (error instanceof ApiError) {
    return apiError(error.status, error.code, error.message, error.fieldErrors);
  }

  if (error instanceof SyntaxError) {
    return apiError(400, "invalid_json", "The request body could not be read.");
  }

  console.error("[api] unhandled error", {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : "unknown",
  });

  return apiError(
    500,
    "internal_error",
    "Something went wrong. Please try again.",
  );
}
