"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// WHY any: posthog-js ships its own copy of the React types, which conflicts
// with the app's copy and makes any strict component type unusable as a JSX
// element under tsc (same duplicate-types breakage as lucide-react icons).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostHogProviderComponent = any;

/**
 * Product analytics + feature flags (PostHog). Opt-in via
 * `NEXT_PUBLIC_POSTHOG_KEY`; without a key the provider renders children
 * only and never initialises. Privacy posture: no session recording, no
 * autocapture, and pageviews carry the pathname only (no query string) —
 * this app handles student academic data and PostHog must not receive it
 * beyond aggregated usage shapes.
 *
 * posthog-js is loaded with a dynamic import after mount so it stays out
 * of the initial bundle for every page; analytics never block first paint.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const [Provider, setProvider] = useState<PostHogProviderComponent | null>(
    null,
  );

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    let cancelled = false;

    void import("posthog-js/react").then((module) => {
      if (!cancelled) {
        setProvider(() => module.PostHogProvider as PostHogProviderComponent);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  if (!apiKey || !Provider) {
    return <>{children}</>;
  }

  return (
    <Provider
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
    </Provider>
  );
}

function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    void import("posthog-js").then((module) => {
      module.default.capture("$pageview", { $current_url: pathname });
    });
  }, [pathname]);

  return null;
}
