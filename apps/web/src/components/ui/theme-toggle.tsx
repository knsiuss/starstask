"use client";

import { Moon, Sun } from "lucide-react";
import * as React from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = THEME_STORAGE_KEY;

function subscribeToTheme(): () => void {
  return () => {};
}

function resolveTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Storage may be unavailable; fall through to the OS preference.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Light/dark switch. The choice is persisted in localStorage; the inline
 * script in the root layout applies it before first paint so there is no
 * flash of the wrong theme.
 */
export function ThemeToggle() {
  // The server snapshot keeps hydration deterministic; the stored or OS
  // preference takes over only after hydration.
  const theme = React.useSyncExternalStore(
    subscribeToTheme,
    resolveTheme,
    () => "light" as ThemePreference,
  );
  const [override, setOverride] = React.useState<ThemePreference | null>(null);
  const activeTheme = override ?? theme;

  const toggle = () => {
    const next: ThemePreference = activeTheme === "dark" ? "light" : "dark";

    setOverride(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing may refuse storage; the toggle still applies.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={activeTheme === "dark"}
      aria-label={
        activeTheme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme"
      }
      className="border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent flex h-9 w-9 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {activeTheme === "dark" ? (
        <Sun
          aria-hidden="true"
          className="h-5 w-5"
        />
      ) : (
        <Moon
          aria-hidden="true"
          className="h-5 w-5"
        />
      )}
    </button>
  );
}
