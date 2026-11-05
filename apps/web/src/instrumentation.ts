import type { Instrumentation } from "next";

import { isSentryConfigured } from "./lib/observability/sentry-env";

/**
 * Wires up the Sentry SDK for whichever server runtime Next boots, then
 * exports the request-error hook. The internal developer dashboard hook is
 * preserved and runs alongside Sentry; Sentry is inert without a DSN.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Captures unexpected server errors for the internal developer dashboard
 * and, when configured, Sentry.
 *
 * Only the route template, HTTP method, error name, and Next digest are
 * stored internally; the message, stack, headers, cookies, and request body
 * never leave the internal store. Monitoring is skipped entirely when the
 * service role is absent.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (isSentryConfigured()) {
    const { captureRequestError } = await import("@sentry/nextjs");
    captureRequestError(error, request, context);
  }

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
