"use client";

import { useEffect } from "react";

import posthog from "posthog-js";

/**
 * Identifies the signed-in user to PostHog so feature-flag targeting
 * (including beta rollouts) can be evaluated per user. Renders nothing.
 * Without a PostHog key the provider never initialises and identify is
 * a no-op in posthog-js.
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

    posthog.identify(userId, { betaTester });
  }, [userId, betaTester]);

  return null;
}
