"use client";

import Link from "next/link";
import * as React from "react";
import { Megaphone, X } from "lucide-react";

import {
  isWhatsNewDismissed,
  persistSeenWhatsNewVersion,
  readSeenWhatsNewVersion,
  WHATS_NEW_HIGHLIGHTS,
} from "./whats-new-helpers";

function subscribeToSeen(): () => void {
  return () => {};
}

function seenVersion(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return readSeenWhatsNewVersion(window.localStorage);
}

/**
 * Compact, dismissible release announcement banner for the `/app` dashboard.
 * Dismissal is persisted per release version in localStorage.
 */
export function WhatsNewBanner() {
  // Server snapshot keeps hydration deterministic; the stored dismissal
  // takes over only after hydration (same pattern as the theme toggle).
  const storedSeen = React.useSyncExternalStore(
    subscribeToSeen,
    seenVersion,
    () => null,
  );
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || isWhatsNewDismissed(storedSeen)) {
    return null;
  }

  const dismiss = () => {
    if (typeof window !== "undefined") {
      persistSeenWhatsNewVersion(window.localStorage);
    }

    setDismissed(true);
  };

  return (
    <section
      role="status"
      aria-label="What's new"
      className="border-border bg-surface mt-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 sm:px-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-accent-soft text-accent mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        >
          <Megaphone className="h-3.5 w-3.5" />
        </span>

        <div className="min-w-0">
          <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
            What&rsquo;s new
          </p>

          <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs leading-relaxed">
            {WHATS_NEW_HIGHLIGHTS.map((item) => (
              <li key={item.href + item.text}>
                <Link
                  href={item.href}
                  className="hover:text-foreground focus-visible:text-foreground underline-offset-4 hover:underline"
                >
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss what's new announcement"
        className="text-muted-foreground hover:text-foreground hover:bg-hover shrink-0 rounded-md p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <X
          aria-hidden="true"
          className="h-4 w-4"
        />
      </button>
    </section>
  );
}
