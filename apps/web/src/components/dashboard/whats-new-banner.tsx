"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/**
 * Latest release announcement.
 *
 * Bump `WHATS_NEW_VERSION` (and the highlights below) on each release that
 * deserves a banner. The banner shows until the user dismisses it; the
 * dismissal is stored per version in localStorage, so a new version shows
 * again without any database migration.
 */
const WHATS_NEW_VERSION = "2026-11-05";
const SEEN_STORAGE_KEY = "starstask-whats-new-seen";

const HIGHLIGHTS = [
  {
    text: "Page transitions and loading skeletons — navigation no longer feels frozen.",
    href: "/app",
  },
  {
    text: "GPS check-in failed? Your class admin can now mark you present manually.",
    href: "/attendance",
  },
  {
    text: "Attendance history is now compact — two rows visible, scroll for the rest.",
    href: "/attendance?tab=history",
  },
] as const;

function subscribeToSeen(): () => void {
  return () => {};
}

function seenVersion(): string | null {
  try {
    return window.localStorage.getItem(SEEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function WhatsNewBanner() {
  // Server snapshot keeps hydration deterministic; the stored dismissal
  // takes over only after hydration (same pattern as the theme toggle).
  const storedSeen = React.useSyncExternalStore(
    subscribeToSeen,
    seenVersion,
    () => null,
  );
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || storedSeen === WHATS_NEW_VERSION) {
    return null;
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, WHATS_NEW_VERSION);
    } catch {
      // Dismissal is best-effort; the banner simply shows again next visit.
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-label="What's new"
      className="border-accent/30 bg-accent-soft rise-in mt-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 rounded-xl border px-4 py-3.5 sm:px-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-surface text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        >
          <Sparkles className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">
            What&rsquo;s new
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs leading-relaxed">
            {HIGHLIGHTS.map((item) => (
              <li key={item.text}>
                <Link
                  href={item.href}
                  className="hover:text-foreground hover:underline underline-offset-4"
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
        className="text-muted-foreground hover:text-foreground shrink-0 rounded-lg p-1.5 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <X
          aria-hidden="true"
          className="h-4 w-4"
        />
      </button>
    </div>
  );
}
