"use client";

import { CalendarDays, Clock } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

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
  // name, so show the full display name instead of a lone initial.
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
    <header className="border-border bg-surface rounded-xl border px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-foreground truncate text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
            {greeting}, {name ?? "Welcome"}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
            {summary ?? "Your academic schedule and tasks for today."}
          </p>
        </div>

        <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-2.5 text-xs sm:shrink-0 sm:flex-nowrap sm:border-t-0 sm:pt-0">
          <p className="text-muted-foreground inline-flex items-center gap-1.5 font-medium">
            <CalendarDays
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0"
            />
            <span>{dateLabel}</span>
          </p>

          <span
            aria-hidden="true"
            className="bg-border hidden h-3.5 w-px sm:block"
          />

          <p className="text-muted-foreground inline-flex items-center gap-1.5">
            <Clock
              aria-hidden="true"
              className="text-accent h-3.5 w-3.5 shrink-0"
            />
            <span className="text-foreground font-semibold tabular-nums">
              <span className="sr-only">Current time: </span>
              <time dateTime={now.toISOString()}>{clockLabel}</time>
            </span>
            <span>{zoneLabel}</span>
          </p>
        </div>
      </div>
    </header>
  );
}
