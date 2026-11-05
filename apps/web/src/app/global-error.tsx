"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Catches React render errors anywhere in the App Router and forwards
 * them to Sentry (a no-op without a DSN). Replaces the default error UI
 * so the error reaches Sentry even on routes without their own error.tsx.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  // Plain markup instead of `next/error`: that component's types clash
  // with the duplicate React types in this workspace and break `tsc`.
  return (
    <html lang="en">
      <body>
        <main
          style={{
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            padding: "4rem 1rem",
          }}
        >
          <h1>Something went wrong</h1>
          <p>Please try again in a moment.</p>
        </main>
      </body>
    </html>
  );
}
