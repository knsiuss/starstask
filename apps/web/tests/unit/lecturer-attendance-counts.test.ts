import { describe, expect, it } from "vitest";

import { summarizeMeetingCounts } from "@/lib/db/lecturer-attendance";

const NOW = Date.parse("2026-11-18T12:00:00.000Z");

function row(
  overrides: Partial<Parameters<typeof summarizeMeetingCounts>[0][number]> = {},
) {
  return {
    class_id: "class-a",
    ends_at: "2026-11-18T13:00:00.000Z",
    attendance_opened_at: null,
    attendance_closed_at: null,
    attendance_finalized_at: null,
    attendance_closes_at: null,
    ...overrides,
  };
}

describe("summarizeMeetingCounts", () => {
  it("returns an empty map for no rows", () => {
    expect(summarizeMeetingCounts([], NOW).size).toBe(0);
  });

  it("counts totals per class and groups classes separately", () => {
    const counts = summarizeMeetingCounts(
      [row(), row(), row({ class_id: "class-b" })],
      NOW,
    );

    expect(counts.get("class-a")?.totalMeetings).toBe(2);
    expect(counts.get("class-b")?.totalMeetings).toBe(1);
  });

  it("counts a meeting whose attendance is opened and not yet closing as open", () => {
    const counts = summarizeMeetingCounts(
      [
        row({
          attendance_opened_at: "2026-11-18T11:00:00.000Z",
          attendance_closes_at: "2026-11-18T13:00:00.000Z",
        }),
      ],
      NOW,
    );

    expect(counts.get("class-a")?.openMeetings).toBe(1);
  });

  it("does not count an opened meeting whose closing time has passed as open", () => {
    const counts = summarizeMeetingCounts(
      [
        row({
          attendance_opened_at: "2026-11-18T09:00:00.000Z",
          attendance_closes_at: "2026-11-18T10:00:00.000Z",
        }),
      ],
      NOW,
    );

    expect(counts.get("class-a")?.openMeetings).toBe(0);
    expect(counts.get("class-a")?.totalMeetings).toBe(1);
  });

  it("does not count a scheduled (never opened) meeting as open", () => {
    const counts = summarizeMeetingCounts([row()], NOW);

    expect(counts.get("class-a")?.openMeetings).toBe(0);
  });

  it("does not count closed or finalized meetings as open", () => {
    const counts = summarizeMeetingCounts(
      [
        row({
          attendance_opened_at: "2026-11-18T09:00:00.000Z",
          attendance_closed_at: "2026-11-18T10:00:00.000Z",
        }),
        row({
          attendance_opened_at: "2026-11-18T09:00:00.000Z",
          attendance_closed_at: "2026-11-18T10:00:00.000Z",
          attendance_finalized_at: "2026-11-18T10:30:00.000Z",
        }),
      ],
      NOW,
    );

    expect(counts.get("class-a")?.openMeetings).toBe(0);
    expect(counts.get("class-a")?.totalMeetings).toBe(2);
  });
});
