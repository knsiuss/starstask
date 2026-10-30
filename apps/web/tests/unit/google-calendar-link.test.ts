import { describe, expect, it } from "vitest";

import {
  buildCalendarDetails,
  buildGoogleCalendarUrl,
  toGoogleCalendarDate,
} from "@starstask/shared";

const SESSION = {
  title: "Midterm review",
  description: "Walk through the 2025 past papers together.",
  agenda: "1. Data structures\n2. Complexity",
  startsAt: "2026-11-05T12:00:00.000Z",
  endsAt: "2026-11-05T14:00:00.000Z",
  timeZone: "Asia/Jakarta",
  location: null,
  meetingUrl: "https://meet.example.com/abc-defg-hij",
  status: "scheduled",
};

function params(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("toGoogleCalendarDate", () => {
  it("formats an instant as UTC basic time", () => {
    expect(toGoogleCalendarDate("2026-11-05T12:00:00.000Z")).toBe(
      "20261105T120000Z",
    );
  });

  it("converts an offset input to UTC", () => {
    expect(toGoogleCalendarDate("2026-11-05T19:00:00+07:00")).toBe(
      "20261105T120000Z",
    );
  });

  it("returns null for an unparseable value", () => {
    expect(toGoogleCalendarDate("next tuesday")).toBeNull();
  });
});

describe("buildGoogleCalendarUrl", () => {
  it("builds a render URL with every field encoded", () => {
    const url = buildGoogleCalendarUrl(SESSION);

    expect(url).not.toBeNull();
    if (!url) {
      return;
    }

    const search = params(url);

    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(
      true,
    );
    expect(search.get("action")).toBe("TEMPLATE");
    expect(search.get("text")).toBe("Midterm review");
    expect(search.get("dates")).toBe("20261105T120000Z/20261105T140000Z");
    expect(search.get("ctz")).toBe("Asia/Jakarta");
    expect(search.get("location")).toBe(
      "https://meet.example.com/abc-defg-hij",
    );
  });

  it("keeps the session time zone rather than converting to the reader's", () => {
    const url = buildGoogleCalendarUrl({
      ...SESSION,
      timeZone: "America/New_York",
    });

    expect(url).not.toBeNull();
    if (url) {
      expect(params(url).get("ctz")).toBe("America/New_York");
      // The instants stay absolute; only the zone label travels with them.
      expect(params(url).get("dates")).toBe(
        "20261105T120000Z/20261105T140000Z",
      );
    }
  });

  it("encodes characters that would otherwise break the query", () => {
    const url = buildGoogleCalendarUrl({
      ...SESSION,
      title: "Q&A: recursion & DP",
    });

    expect(url).not.toBeNull();
    if (url) {
      expect(params(url).get("text")).toBe("Q&A: recursion & DP");
      expect(url).toContain("text=Q%26A%3A+recursion+%26+DP");
    }
  });

  it("puts the agenda and join link in the details", () => {
    const url = buildGoogleCalendarUrl(SESSION);

    expect(url).not.toBeNull();
    if (url) {
      const details = params(url).get("details") ?? "";

      expect(details).toContain("Walk through the 2025 past papers together.");
      expect(details).toContain("Agenda:");
      expect(details).toContain("Join online: https://meet.example.com/");
      expect(details).toContain("Session: Midterm review");
    }
  });

  it("falls back to the physical location for an in-person session", () => {
    const url = buildGoogleCalendarUrl({
      ...SESSION,
      meetingUrl: null,
      location: "Room 3.14",
    });

    expect(url).not.toBeNull();
    if (url) {
      expect(params(url).get("location")).toBe("Room 3.14");
      expect(params(url).get("details")).toContain("Location: Room 3.14");
    }
  });

  it("omits the location parameter when there is none", () => {
    const url = buildGoogleCalendarUrl({
      ...SESSION,
      meetingUrl: null,
      location: null,
    });

    expect(url).not.toBeNull();
    if (url) {
      expect(params(url).has("location")).toBe(false);
    }
  });

  it("returns null for a cancelled session", () => {
    expect(
      buildGoogleCalendarUrl({ ...SESSION, status: "cancelled" }),
    ).toBeNull();
  });

  it("returns null for a completed session", () => {
    expect(
      buildGoogleCalendarUrl({ ...SESSION, status: "completed" }),
    ).toBeNull();
  });

  it("returns null when the window is inverted", () => {
    expect(
      buildGoogleCalendarUrl({
        ...SESSION,
        startsAt: "2026-11-05T14:00:00.000Z",
        endsAt: "2026-11-05T12:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("returns null when a timestamp cannot be parsed", () => {
    expect(
      buildGoogleCalendarUrl({ ...SESSION, startsAt: "tomorrow" }),
    ).toBeNull();
  });
});

describe("buildCalendarDetails", () => {
  it("carries no participant or RSVP information", () => {
    const details = buildCalendarDetails({
      title: SESSION.title,
      description: SESSION.description,
      agenda: SESSION.agenda,
      meetingUrl: SESSION.meetingUrl,
      location: null,
    });

    expect(details).not.toMatch(/going/i);
    expect(details).not.toMatch(/rsvp/i);
    expect(details).not.toMatch(/organis|organiz/i);
  });

  it("truncates a very long description", () => {
    const details = buildCalendarDetails({
      title: SESSION.title,
      description: "x".repeat(5_000),
      agenda: null,
      meetingUrl: null,
      location: null,
    });

    expect(details.length).toBeLessThanOrEqual(1_200);
    expect(details.endsWith("…")).toBe(true);
  });

  it("skips an empty agenda", () => {
    const details = buildCalendarDetails({
      title: SESSION.title,
      description: SESSION.description,
      agenda: "   ",
      meetingUrl: null,
      location: null,
    });

    expect(details).not.toContain("Agenda:");
  });
});
