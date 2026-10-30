import { describe, expect, it } from "vitest";

import {
  buildIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  formatIcsDate,
  formatIcsInstant,
} from "@starstask/shared";

const FIXED_NOW = new Date("2026-10-29T03:00:00.000Z");

describe("escapeIcsText", () => {
  it("escapes backslashes before newlines so an escape is never doubled", () => {
    expect(escapeIcsText("C:\\temp\nnext")).toBe("C:\\\\temp\\nnext");
  });

  it("escapes semicolons and commas", () => {
    expect(escapeIcsText("a;b,c")).toBe("a\\;b\\,c");
  });
});

describe("formatIcsInstant", () => {
  it("formats a UTC instant without punctuation", () => {
    expect(formatIcsInstant("2026-10-29T03:04:05.000Z")).toBe(
      "20261029T030405Z",
    );
  });

  it("returns null for an invalid date", () => {
    expect(formatIcsInstant("not-a-date")).toBeNull();
  });
});

describe("formatIcsDate", () => {
  it("accepts a real date key", () => {
    expect(formatIcsDate("2026-10-29")).toBe("20261029");
  });

  it("rejects an impossible calendar date", () => {
    expect(formatIcsDate("2026-02-30")).toBeNull();
  });

  it("rejects date-times and partial values", () => {
    expect(formatIcsDate("2026-10-29T10:00:00Z")).toBeNull();
    expect(formatIcsDate("2026-10")).toBeNull();
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines untouched", () => {
    expect(foldIcsLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  it("folds at 75 octets with a leading space on continuations", () => {
    const folded = foldIcsLine("DESCRIPTION:" + "a".repeat(100));
    const lines = folded.split("\r\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveLength(75);
    expect(lines[1]?.startsWith(" ")).toBe(true);
    expect(lines.join("").replace(/ /g, "")).toBe(
      "DESCRIPTION:" + "a".repeat(100),
    );
  });

  it("never splits a multibyte character", () => {
    // Each emoji is four UTF-8 bytes, so a naive character fold would produce
    // lines above 75 octets or corrupt the text.
    const folded = foldIcsLine("SUMMARY:" + "🎓".repeat(30));

    for (const line of folded.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }

    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "🎓".repeat(30));
  });
});

describe("buildIcsCalendar", () => {
  it("wraps events in a calendar with CRLF line endings", () => {
    const output = buildIcsCalendar(
      {
        name: "Database Systems",
        events: [
          {
            uid: "assignment-1@starstask",
            title: "ERD assignment",
            startsAt: "2026-11-02T15:59:00.000Z",
            endsAt: "2026-11-02T16:29:00.000Z",
          },
        ],
      },
      FIXED_NOW,
    );

    expect(output.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(output.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(output).toContain("BEGIN:VEVENT\r\n");
    expect(output).toContain("DTSTAMP:20261029T030000Z");
    expect(output).toContain("DTSTART:20261102T155900Z");
    expect(output).toContain("DTEND:20261102T162900Z");
    expect(output).toContain("SUMMARY:ERD assignment");
    expect(output).toContain("X-WR-CALNAME:Database Systems");
  });

  it("defaults a missing end to one hour after the start", () => {
    const output = buildIcsCalendar(
      {
        name: "Class",
        events: [
          {
            uid: "session-1@starstask",
            title: "Review",
            startsAt: "2026-11-02T10:00:00.000Z",
          },
        ],
      },
      FIXED_NOW,
    );

    expect(output).toContain("DTSTART:20261102T100000Z");
    expect(output).toContain("DTEND:20261102T110000Z");
  });

  it("writes all-day events as DATE values ending the next day", () => {
    const output = buildIcsCalendar(
      {
        name: "Class",
        events: [
          {
            uid: "leave-1@starstask",
            title: "Family matter",
            startsAt: "2026-11-02",
            allDay: true,
          },
        ],
      },
      FIXED_NOW,
    );

    expect(output).toContain("DTSTART;VALUE=DATE:20261102");
    expect(output).toContain("DTEND;VALUE=DATE:20261103");
  });

  it("skips an event whose date cannot be parsed", () => {
    const output = buildIcsCalendar(
      {
        name: "Class",
        events: [
          {
            uid: "broken@starstask",
            title: "Broken",
            startsAt: "whenever",
          },
          {
            uid: "ok@starstask",
            title: "Valid",
            startsAt: "2026-11-02T10:00:00.000Z",
          },
        ],
      },
      FIXED_NOW,
    );

    expect(output).not.toContain("SUMMARY:Broken");
    expect(output).toContain("SUMMARY:Valid");
  });

  it("escapes commas in names and titles", () => {
    const output = buildIcsCalendar(
      {
        name: "Databases, Section A",
        events: [
          {
            uid: "one@starstask",
            title: "Read, then write",
            startsAt: "2026-11-02T10:00:00.000Z",
          },
        ],
      },
      FIXED_NOW,
    );

    expect(output).toContain("X-WR-CALNAME:Databases\\, Section A");
    expect(output).toContain("SUMMARY:Read\\, then write");
  });
});
