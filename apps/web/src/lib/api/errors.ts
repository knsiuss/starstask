/**
 * Error type that route handlers may throw. The message is safe to show to
 * clients; internal details belong in logs, not here.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function unauthorized(): ApiError {
  return new ApiError(401, "unauthorized", "Sign in to continue.");
}

export function forbidden(): ApiError {
  return new ApiError(
    403,
    "forbidden",
    "You do not have access to this resource.",
  );
}

export function notFound(): ApiError {
  return new ApiError(
    404,
    "not_found",
    "The requested resource was not found.",
  );
}

export function tooManyRequests(retryAfterSeconds: number): ApiError {
  return new ApiError(
    429,
    "rate_limited",
    `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
  );
}

export function serviceUnavailable(): ApiError {
  return new ApiError(
    503,
    "service_unavailable",
    "The application is not fully configured yet.",
  );
}
