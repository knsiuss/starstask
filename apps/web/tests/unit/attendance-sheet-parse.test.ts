import { describe, expect, it } from "vitest";

import { parseAttendanceSheetText } from "@/lib/ocr/attendance-sheet-parse";

describe("parseAttendanceSheetText", () => {
  it("marks present when a tick is on the NIM line", () => {
    const hits = parseAttendanceSheetText(
      "210100001 Budi Santoso ✓\n210100002 Ani Lestari\n",
      ["210100001", "210100002"],
    );

    expect(hits).toEqual([
      expect.objectContaining({
        studentCode: "210100001",
        present: true,
      }),
      expect.objectContaining({
        studentCode: "210100002",
        present: false,
      }),
    ]);
  });

  it("ignores unknown NIMs and returns empty for no matches", () => {
    expect(
      parseAttendanceSheetText("999999999 Unknown ✓", ["210100001"]),
    ).toEqual([]);
  });
});
