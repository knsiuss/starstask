import { describe, expect, it } from "vitest";

import {
  getDeadlineBucket,
  getDueSoonWindow,
  getJakartaDayDifference,
} from "@starstask/shared";

// 2026-10-29 10:00 WIB == 03:00 UTC.
const NOW = new Date("2026-10-29T03:00:00.000Z");

describe("getDeadlineBucket", () => {
  it("returns none for a missing or invalid deadline", () => {
    expect(getDeadlineBucket(null, NOW)).toBe("none");
    expect(getDeadlineBucket(undefined, NOW)).toBe("none");
    expect(getDeadlineBucket("not-a-date", NOW)).toBe("none");
  });

  it("marks the previous Jakarta day as overdue", () => {
    expect(getDeadlineBucket("2026-10-28T16:59:00.000Z", NOW)).toBe("overdue");
  });

  it("keeps an earlier instant today as due today, not overdue", () => {
    expect(getDeadlineBucket("2026-10-29T02:00:00.000Z", NOW)).toBe(
      "due_today",
    );
  });

  it("keeps the last instant of today as due today", () => {
    expect(getDeadlineBucket("2026-10-29T16:59:00.000Z", NOW)).toBe(
      "due_today",
    );
  });

  it("starts the due-soon window at Jakarta midnight", () => {
    expect(getDeadlineBucket("2026-10-29T17:00:00.000Z", NOW)).toBe("due_soon");
  });

  it("includes the seventh calendar day after today", () => {
    expect(getDeadlineBucket("2026-11-05T16:59:00.000Z", NOW)).toBe("due_soon");
  });

  it("excludes the eighth calendar day after today", () => {
    expect(getDeadlineBucket("2026-11-05T17:00:00.000Z", NOW)).toBe("later");
  });

  it("changes bucket when the Jakarta date rolls over", () => {
    const beforeMidnight = new Date("2026-10-29T16:59:00.000Z");
    const afterMidnight = new Date("2026-10-29T17:00:00.000Z");
    const deadline = "2026-10-30T16:59:00.000Z";

    expect(getDeadlineBucket(deadline, beforeMidnight)).toBe("due_soon");
    expect(getDeadlineBucket(deadline, afterMidnight)).toBe("due_today");
  });
});

describe("getDueSoonWindow", () => {
  it("covers today through the next seven Jakarta calendar days", () => {
    const window = getDueSoonWindow(NOW);

    expect(window.start.toISOString()).toBe("2026-10-28T17:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-05T17:00:00.000Z");
  });

  it("keeps the same window just before and after Jakarta midnight", () => {
    const beforeMidnight = new Date("2026-10-29T16:59:00.000Z");
    const afterMidnight = new Date("2026-10-29T17:00:00.000Z");

    expect(getDueSoonWindow(beforeMidnight).start.toISOString()).toBe(
      "2026-10-28T17:00:00.000Z",
    );
    expect(getDueSoonWindow(afterMidnight).start.toISOString()).toBe(
      "2026-10-29T17:00:00.000Z",
    );
  });
});

describe("getJakartaDayDifference", () => {
  it("counts Jakarta calendar days, not elapsed hours", () => {
    expect(getJakartaDayDifference("2026-10-29T17:00:00.000Z", NOW)).toBe(1);
    expect(getJakartaDayDifference("2026-10-28T16:59:00.000Z", NOW)).toBe(-1);
  });
});
