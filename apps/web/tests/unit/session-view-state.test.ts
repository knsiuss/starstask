import { describe, expect, it } from "vitest";

import { resolveSessionViewerState } from "@/features/sessions/view-state";

const NOW = new Date("2026-11-05T10:00:00.000Z");

const SESSION = {
  status: "scheduled" as const,
  startsAt: "2026-11-05T12:00:00.000Z",
  registrationDeadline: null as string | null,
  timeZone: "Asia/Jakarta",
};

describe("resolveSessionViewerState", () => {
  it("keeps RSVP closed for a signed-out visitor", () => {
    const state = resolveSessionViewerState(SESSION, {
      isSignedIn: false,
      now: NOW,
    });

    expect(state.canRespond).toBe(false);
    expect(state.closedReason).toBeNull();
  });

  it("opens RSVP for a signed-in member of a scheduled future session", () => {
    const state = resolveSessionViewerState(SESSION, {
      isSignedIn: true,
      now: NOW,
    });

    expect(state.canRespond).toBe(true);
    expect(state.closedReason).toBeNull();
  });

  it("explains a cancelled session", () => {
    const state = resolveSessionViewerState(
      { ...SESSION, status: "cancelled" },
      { isSignedIn: true, now: NOW },
    );

    expect(state.canRespond).toBe(false);
    expect(state.closedReason).toMatch(/cancelled/i);
  });

  it("explains a completed session", () => {
    const state = resolveSessionViewerState(
      { ...SESSION, status: "completed" },
      { isSignedIn: true, now: NOW },
    );

    expect(state.canRespond).toBe(false);
    expect(state.closedReason).toMatch(/already taken place/i);
  });

  it("names the registration deadline once it passed", () => {
    const state = resolveSessionViewerState(
      { ...SESSION, registrationDeadline: "2026-11-05T09:00:00.000Z" },
      { isSignedIn: true, now: NOW },
    );

    expect(state.canRespond).toBe(false);
    expect(state.closedReason).toContain("Registration closed on");
    expect(state.closedReason).toContain("16:00");
  });

  it("explains a session that already started", () => {
    const state = resolveSessionViewerState(
      { ...SESSION, startsAt: "2026-11-05T09:00:00.000Z" },
      { isSignedIn: true, now: NOW },
    );

    expect(state.canRespond).toBe(false);
    expect(state.closedReason).toMatch(/already started/i);
  });

  it("defaults to the current time when none is injected", () => {
    const state = resolveSessionViewerState(
      { ...SESSION, startsAt: "2020-01-01T00:00:00.000Z" },
      { isSignedIn: true },
    );

    expect(state.canRespond).toBe(false);
  });
});
