import * as Sentry from "@sentry/nextjs";

import {
  getSentryDsn,
  getSentryEnvironment,
} from "./lib/observability/sentry-env";

const dsn = getSentryDsn();

// Edge errors and tracing only; no PII is sent (see the client config).
// Sentry is inert without a DSN.
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
