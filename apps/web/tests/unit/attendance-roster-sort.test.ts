import { describe, expect, it } from "vitest";

import { sortAttendanceRoster } from "@starstask/shared";

describe("sortAttendanceRoster", () => {
  it("sorts full names alphabetically and case-insensitively", () => {
    const sorted = sortAttendanceRoster([
      { fullName: "budi santoso", nim: "3" },
      { fullName: "Ahmad Fauzi", nim: "1" },
      { fullName: "ayu lestari", nim: "2" },
    ]);

    expect(sorted.map((entry) => entry.fullName)).toEqual([
      "Ahmad Fauzi",
      "ayu lestari",
      "budi santoso",
    ]);
  });

  it("places accented names next to their unaccented spelling", () => {
    const sorted = sortAttendanceRoster([
      { fullName: "Zahra", nim: "4" },
      { fullName: "Álvaro", nim: "2" },
      { fullName: "Alvin", nim: "1" },
    ]);

    expect(sorted[0]?.fullName).toBe("Álvaro");
    expect(sorted[1]?.fullName).toBe("Alvin");
  });

  it("breaks a name tie by NIM in numeric order", () => {
    const sorted = sortAttendanceRoster([
      { fullName: "Sari Dewi", nim: "1002" },
      { fullName: "Sari Dewi", nim: "101" },
      { fullName: "Sari Dewi", nim: "100" },
    ]);

    expect(sorted.map((entry) => entry.nim)).toEqual(["100", "101", "1002"]);
  });

  it("puts a missing NIM after a known NIM with the same name", () => {
    const sorted = sortAttendanceRoster([
      { fullName: "Rina", nim: null },
      { fullName: "Rina", nim: "211201" },
    ]);

    expect(sorted.map((entry) => entry.nim)).toEqual(["211201", null]);
  });

  it("treats a blank NIM as missing", () => {
    const sorted = sortAttendanceRoster([
      { fullName: "Tono", nim: "   " },
      { fullName: "Tono", nim: "9" },
    ]);

    expect(sorted[0]?.nim).toBe("9");
  });

  it("does not mutate the input array", () => {
    const input = [
      { fullName: "B", nim: null },
      { fullName: "A", nim: null },
    ];

    sortAttendanceRoster(input);

    expect(input.map((entry) => entry.fullName)).toEqual(["B", "A"]);
  });
});
