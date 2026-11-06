"use client";

import { CalendarDays, Clock } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import {
  APP_TIME_ZONE,
  isKnownTimeZone,
  timeZoneLabel,
} from "@starstask/shared";

type DashboardHeaderProps = {
  displayName: string | null;
  initialNowIso: string;
  initialTimeZone: string | null;
  /** One-line status derived from real stats; falls back to static copy. */
  summary?: string | null;
};

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const clockFormatterCache = new Map<string, Intl.DateTimeFormat>();
const hourFormatterCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  dateFormatterCache.set(timeZone, formatter);

  return formatter;
}

function clockFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = clockFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  clockFormatterCache.set(timeZone, formatter);

  return formatter;
}

function hourFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = hourFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  });

  hourFormatterCache.set(timeZone, formatter);

  return formatter;
}

function subscribeToTimeZone(): () => void {
  return () => {};
}

function greetingFor(now: Date, timeZone: string): string {
  const hour = Number(hourFormatter(timeZone).format(now));

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function firstName(displayName: string | null): string | null {
  const cleaned = displayName?.trim().replace(/^@+/, "");

  if (!cleaned) {
    return null;
  }

  const parts = cleaned.split(/\s+/);
  const first = parts[0];

  // A single-letter first token is an initial ("P KANISIUS ..."), not a
  // name — show the full display name instead of a lone initial.
  if (first && first.length > 1) {
    return first;
  }

  return cleaned;
}

/**
 * Welcome banner with a live clock.
 *
 * The clock owns its own state and one-minute interval, so only this component
 * re-renders on each tick. The stored notification timezone wins; without one
 * the browser zone is used, falling back to the app zone during hydration.
 */
export function DashboardHeader({
  displayName,
  initialNowIso,
  initialTimeZone,
  summary = null,
}: DashboardHeaderProps) {
  const [now, setNow] = useState(() => new Date(initialNowIso));

  // The server snapshot keeps hydration deterministic; the browser zone takes
  // over only after hydration when no zone is configured.
  const timeZone = useSyncExternalStore(
    subscribeToTimeZone,
    () => initialTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => initialTimeZone,
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const zone = timeZone && isKnownTimeZone(timeZone) ? timeZone : APP_TIME_ZONE;
  const greeting = greetingFor(now, zone);
  const name = firstName(displayName);
  const dateLabel = dateFormatter(zone).format(now);
  const clockLabel = clockFormatter(zone).format(now);
  const zoneLabel = timeZoneLabel(zone);

  return (
    <header className="glass-card rise-in relative overflow-hidden rounded-2xl px-4 py-5 sm:px-6 sm:py-6">
      <div
        aria-hidden="true"
        className="from-accent-soft via-band to-surface pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-l opacity-70 sm:block"
      />

      <div className="relative flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm font-medium sm:text-base">
            {greeting},
          </p>
          <h1 className="text-foreground mt-0.5 truncate text-[26px] leading-tight font-bold tracking-tight uppercase sm:text-[30px]">
            {name ?? "Welcome"}
          </h1>
          <span
            aria-hidden="true"
            className="greet-bar mt-2 block h-1 w-12 rounded-full"
          />
          <p className="text-muted-foreground mt-2.5 max-w-xl text-sm leading-relaxed">
            {summary ?? "Keep going! You've got this."}
          </p>
        </div>

        <div
          aria-hidden="true"
          className="hidden shrink-0 sm:block"
        >
          <BrandMark
            size={88}
            className="st-float opacity-90"
          />
        </div>
      </div>

      <div className="border-border relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3.5">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-accent-soft text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
            <CalendarDays
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </span>
          {dateLabel}
        </p>
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-accent-soft text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
            <Clock
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </span>
          <span className="text-foreground font-semibold tabular-nums">
            <span className="sr-only">Current time: </span>
            <time dateTime={now.toISOString()}>{clockLabel}</time>
          </span>
          {zoneLabel}
        </p>
      </div>
    </header>
  );
}
