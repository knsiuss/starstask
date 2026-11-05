"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
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

  return (
    <html lang="en">
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App
        Router does not expose status codes for errors, we simply pass 0 to
        render a generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
