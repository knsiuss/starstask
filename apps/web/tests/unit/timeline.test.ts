import { describe, expect, it } from "vitest";

import {
  MAX_VISIBLE_LANES,
  WEEK_DAY_COUNT,
  layoutWeekRow,
  overlapsWeek,
  splitIntoWeeks,
} from "@/lib/schedule/timeline";
import { courseColorFor } from "@/lib/schedule/course-colors";

const ROW_START = "2026-12-07"; // Monday

function span(
  id: string,
  startKey: string,
  endKey: string,
): {
  id: string;
  title: string;
  kind: "assignment";
  startKey: string;
  endKey: string;
  href: null;
  courseKey: string;
} {
  return {
    id,
    title: id,
    kind: "assignment",
    startKey,
    endKey,
    href: null,
    courseKey: "c",
  };
}

describe("layoutWeekRow", () => {
  it("places a bar spanning two days with width 2", () => {
    const result = layoutWeekRow(
      [span("a", "2026-12-08", "2026-12-09")],
      ROW_START,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lane).toBe(0);
    expect(result.items[0]?.colStart).toBe(1);
    expect(result.items[0]?.span).toBe(2);
  });

  it("clips bars that start before the row", () => {
    const result = layoutWeekRow(
      [span("a", "2026-12-01", "2026-12-09")],
      ROW_START,
    );

    expect(result.items[0]?.colStart).toBe(0);
    expect(result.items[0]?.span).toBe(3); // Mon 7 to Wed 9
  });

  it("assigns overlapping bars to different lanes in order", () => {
    const result = layoutWeekRow(
      [
        span("a", "2026-12-07", "2026-12-13"),
        span("b", "2026-12-08", "2026-12-12"),
        span("c", "2026-12-10", "2026-12-11"),
      ],
      ROW_START,
    );

    const lanes = new Map(result.items.map((item) => [item.id, item.lane]));

    expect(lanes.get("a")).toBe(0);
    expect(lanes.get("b")).toBe(1);
    expect(lanes.get("c")).toBe(2);
  });

  it("reuses a freed lane for a later, non-overlapping bar", () => {
    const result = layoutWeekRow(
      [
        span("a", "2026-12-07", "2026-12-08"),
        span("b", "2026-12-07", "2026-12-13"),
        span("c", "2026-12-09", "2026-12-13"),
      ],
      ROW_START,
    );

    const lanes = new Map(result.items.map((item) => [item.id, item.lane]));

    // Widest bar takes lane 0; the two short bars share lane 1.
    expect(lanes.get("b")).toBe(0);
    expect(lanes.get("a")).toBe(1);
    expect(lanes.get("c")).toBe(1);
  });

  it("reports bars beyond the lane budget as hidden, keeping the row bounded", () => {
    const many = Array.from({ length: MAX_VISIBLE_LANES + 1 }, (_, index) =>
      span(`m${index}`, "2026-12-07", "2026-12-13"),
    );
    const result = layoutWeekRow(many, ROW_START, MAX_VISIBLE_LANES);

    expect(result.items).toHaveLength(MAX_VISIBLE_LANES);
    expect(result.hidden).toHaveLength(1);
    expect(result.laneCount).toBe(MAX_VISIBLE_LANES);
  });

  it("ignores bars outside the row entirely", () => {
    const result = layoutWeekRow(
      [span("outside", "2026-11-01", "2026-11-30")],
      ROW_START,
    );

    expect(result.items).toHaveLength(0);
    expect(result.hidden).toHaveLength(0);
  });

  it("normalizes inverted spans into a coherent range", () => {
    const result = layoutWeekRow(
      [span("bad", "2026-12-09", "2026-12-08")],
      ROW_START,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.startKey).toBe("2026-12-09");
    expect(result.items[0]?.span).toBe(2); // Dec 8 to Dec 9
  });

  it("sorts same-start bars widest-first so lanes stay stable", () => {
    const result = layoutWeekRow(
      [
        span("narrow", "2026-12-07", "2026-12-07"),
        span("wide", "2026-12-07", "2026-12-10"),
      ],
      ROW_START,
    );

    const wide = result.items.find((item) => item.id === "wide");
    const narrow = result.items.find((item) => item.id === "narrow");

    expect(wide?.lane).toBe(0);
    expect(narrow?.lane).toBe(1);
  });
});

describe("splitIntoWeeks", () => {
  it("slices a 42 day month grid into six rows of seven", () => {
    const days = Array.from({ length: 42 }, (_, index) => ({
      dateKey: `2026-12-${String(index + 1).padStart(2, "0")}`,
    }));

    expect(splitIntoWeeks(days)).toHaveLength(6);
    expect(splitIntoWeeks(days)[0]).toHaveLength(WEEK_DAY_COUNT);
  });
});

describe("overlapsWeek", () => {
  it("includes bars touching either boundary", () => {
    expect(
      overlapsWeek(span("a", "2026-12-01", ROW_START), ROW_START, "2026-12-13"),
    ).toBe(true);
    expect(
      overlapsWeek(
        span("b", "2026-12-13", "2026-12-13"),
        ROW_START,
        "2026-12-13",
      ),
    ).toBe(true);
    expect(
      overlapsWeek(
        span("c", "2027-01-01", "2027-01-02"),
        ROW_START,
        "2026-12-13",
      ),
    ).toBe(false);
  });
});

describe("courseColorFor", () => {
  it("returns the same palette entry for the same key", () => {
    expect(courseColorFor("course-1")).toEqual(courseColorFor("course-1"));
  });

  it("spreads different keys across the palette", () => {
    const keys = ["a", "b", "c", "d", "e", "f"];
    const backgrounds = new Set(
      keys.map((key) => courseColorFor(key).background),
    );

    expect(backgrounds.size).toBeGreaterThan(1);
  });
});
