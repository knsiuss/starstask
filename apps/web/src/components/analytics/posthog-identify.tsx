"use client";

import { useEffect } from "react";

/**
 * Identifies the signed-in user to PostHog so feature-flag targeting
 * (including beta rollouts) can be evaluated per user. Renders nothing.
 * Without a PostHog key the provider never initialises and identify is
 * a no-op in posthog-js. posthog-js is imported lazily so it stays out
 * of the initial bundle.
 */
export function PostHogIdentify({
  userId,
  betaTester,
}: {
  userId: string | null;
  betaTester: boolean;
}) {
  useEffect(() => {
    if (!userId) {
      return;
    }

    void import("posthog-js").then((module) => {
      module.default.identify(userId, { betaTester });
    });
  }, [userId, betaTester]);

  return null;
}
