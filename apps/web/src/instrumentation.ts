import type { Instrumentation } from "next";

/**
 * Captures unexpected server errors for the internal developer dashboard.
 *
 * Only the route template, HTTP method, error name, and Next digest are stored;
 * the message, stack, headers, cookies, and request body never leave the
 * process. Monitoring is skipped entirely when the service role is absent.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { getErrorDigest, recordErrorActivity } =
    await import("./lib/observability/events");

  await recordErrorActivity({
    routePath: context.routePath,
    method: request.method,
    errorName: error instanceof Error ? error.name : null,
    errorDigest: getErrorDigest(error),
  });
};
