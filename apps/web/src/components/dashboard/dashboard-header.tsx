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
  const first = displayName?.trim().split(/\s+/)[0];

  return first && first.length > 0 ? first : null;
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
    <header className="border-border bg-surface rounded-2xl border px-4 py-5 sm:px-6 sm:py-6">
      <p className="text-muted-foreground text-sm font-medium">{greeting},</p>
      <h1 className="text-foreground mt-0.5 truncate text-2xl leading-tight font-semibold tracking-tight sm:text-[30px]">
        {name ?? "Welcome"}
      </h1>
      <p className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-relaxed">
        {summary ?? "Here is an overview of your academic activities today."}
      </p>

      <div className="border-border mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3.5">
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
