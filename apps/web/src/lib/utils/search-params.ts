/**
 * Normalises Next.js `searchParams` into a flat string map.
 *
 * A repeated key keeps its first value, and blank values are dropped because a
 * native `<select>` submits its empty "all" option as `?class=`. Zod then sees
 * only the keys a user actually chose, so optional filters stay optional.
 */
export function flattenSearchParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    const candidate =
      typeof value === "string"
        ? value
        : Array.isArray(value) && typeof value[0] === "string"
          ? value[0]
          : undefined;

    if (candidate) {
      flat[key] = candidate;
    }
  }

  return flat;
}

export type MonthKey = { year: number; month: number };

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * Parses a `YYYY-MM` month control. Anything else falls back to `fallback`,
 * which keeps a hand-edited URL from rendering an empty grid.
 */
export function parseMonthParam(
  value: string | undefined,
  fallback: MonthKey,
): MonthKey {
  if (!value) {
    return fallback;
  }

  const match = MONTH_PATTERN.exec(value);

  if (!match) {
    return fallback;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || year < 1970 || year > 2999) {
    return fallback;
  }

  return { year, month };
}

/** Current month in UTC, matching the calendar grid's own date math. */
export function currentMonth(now: Date = new Date()): MonthKey {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** `YYYY-MM` for a month control or a redirect. */
export function monthParamValue(month: MonthKey): string {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}
