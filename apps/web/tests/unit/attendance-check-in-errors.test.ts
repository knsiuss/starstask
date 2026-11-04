import { describe, expect, it } from "vitest";

import { describeCheckInFailure } from "@/lib/attendance/check-in-errors";
import { describeGeolocationError } from "@/lib/geo/position";

describe("describeCheckInFailure", () => {
  it("explains that the student is outside the permitted area", () => {
    expect(describeCheckInFailure("checkin_too_far", undefined)).toBe(
      "You are outside the permitted attendance area. The server did not return the distance; move closer and try again.",
    );
    expect(
      describeCheckInFailure(
        "checkin_too_far",
        "You are 42 m from the meeting point.",
      ),
    ).toBe("You are 42 m from the meeting point.");
  });

  it("distinguishes a window that has not opened from one that closed", () => {
    expect(describeCheckInFailure("checkin_not_open", undefined)).toBe(
      "Attendance has not been opened for this meeting yet. Wait for your class admin to open it.",
    );
    expect(describeCheckInFailure("checkin_closed", undefined)).toBe(
      "Attendance for this meeting has closed. Ask your class admin if you need a correction.",
    );
  });

  it("asks for a better reading when the location is imprecise", () => {
    expect(describeCheckInFailure("checkin_imprecise", undefined)).toContain(
      "not accurate enough",
    );
  });

  it("asks for a fresh reading when the position is stale", () => {
    expect(
      describeCheckInFailure("checkin_stale_position", undefined),
    ).toContain("stale");
  });

  it("explains that the session does not accept check-ins", () => {
    expect(describeCheckInFailure("checkin_unavailable", undefined)).toBe(
      "This meeting is not open for check-in.",
    );
    expect(describeCheckInFailure("checkin_not_scheduled", undefined)).toBe(
      "This meeting is not open for check-in.",
    );
  });

  it("explains that only class members may check in", () => {
    expect(describeCheckInFailure("forbidden", undefined)).toContain(
      "Only class members",
    );
  });

  it("falls back to the server message, then to generic copy", () => {
    expect(describeCheckInFailure("unknown_code", "Try again later.")).toBe(
      "Try again later.",
    );
    expect(describeCheckInFailure(undefined, undefined)).toBe(
      "Could not check you in. Please try again.",
    );
  });
});

describe("describeGeolocationError", () => {
  it("explains a denied permission", () => {
    expect(describeGeolocationError({ code: 1 })).toContain(
      "permission was denied",
    );
  });

  it("explains an unavailable position", () => {
    expect(describeGeolocationError({ code: 2 })).toContain("unavailable");
  });

  it("explains a timeout", () => {
    expect(describeGeolocationError({ code: 3 })).toContain("took too long");
  });

  it("explains an unsupported browser", () => {
    expect(describeGeolocationError(new Error("unsupported"))).toBe(
      "This browser cannot share your location.",
    );
  });
});
