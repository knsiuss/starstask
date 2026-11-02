const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "day", ms: 86_400_000 },
  { unit: "hour", ms: 3_600_000 },
  { unit: "minute", ms: 60_000 },
];

/** Short "2 hours ago" label; anything older than a week falls back to a date. */
export function relativeTimeFrom(createdAt: string, now: number): string {
  const elapsed = now - new Date(createdAt).getTime();

  for (const { unit, ms } of UNITS) {
    if (elapsed >= ms) {
      return relativeFormatter.format(-Math.floor(elapsed / ms), unit);
    }
  }

  if (elapsed > 7 * 86_400_000) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    }).format(new Date(createdAt));
  }

  return "Just now";
}
