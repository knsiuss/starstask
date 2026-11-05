"use client";

import { PostHogProvider as BaseProvider } from "posthog-js/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

import posthog from "posthog-js";

/**
 * Product analytics + feature flags (PostHog). Opt-in via
 * `NEXT_PUBLIC_POSTHOG_KEY`; without a key the provider renders children
 * only and never initialises. Privacy posture: no session recording, no
 * autocapture, and pageviews carry the pathname only (no query string) —
 * this app handles student academic data and PostHog must not receive it
 * beyond aggregated usage shapes.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <BaseProvider
      apiKey={apiKey}
      options={{
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
      }}
    >
      <PageViewTracker />
      {children}
    </BaseProvider>
  );
}

function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    posthog.capture("$pageview", { $current_url: pathname });
  }, [pathname]);

  return null;
}
