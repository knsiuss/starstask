import * as Sentry from "@sentry/nextjs";

import {
  getSentryDsn,
  getSentryEnvironment,
} from "./lib/observability/sentry-env";

const dsn = getSentryDsn();

// Error + tracing only. No Session Replay, no User Feedback, and no PII:
// this app handles student academic data, so `sendDefaultPii` stays off and
// the SDK never attaches user identity. Sentry is inert without a DSN.
if (dsn) {
  Sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    dataCollection: {
      userInfo: false,
    },
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
