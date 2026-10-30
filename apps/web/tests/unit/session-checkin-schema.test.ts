import { describe, expect, it } from "vitest";

import {
  getSessionCheckInWindow,
  getSessionCheckInWindowState,
  sessionCheckInLocationSchema,
  sessionCheckInRecordSchema,
  sessionCheckInReviewSchema,
  sessionCheckInSchema,
} from "@starstask/contracts";

const STARTS_AT = "2026-11-05T12:00:00.000Z";
const ENDS_AT = "2026-11-05T14:00:00.000Z";
const MEMBER_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";

function reading(overrides: Record<string, unknown> = {}) {
  return {
    latitude: -6.2,
    longitude: 106.8,
    accuracy: 18,
    ...overrides,
  };
}

describe("sessionCheckInSchema", () => {
  it("accepts a plausible location reading", () => {
    expect(sessionCheckInSchema.safeParse(reading()).success).toBe(true);
  });

  it("rejects coordinates outside the real world", () => {
    expect(
      sessionCheckInSchema.safeParse(reading({ latitude: 91 })).success,
    ).toBe(false);
    expect(
      sessionCheckInSchema.safeParse(reading({ longitude: -181 })).success,
    ).toBe(false);
  });

  it("rejects a weak fix instead of letting the server do it later", () => {
    const result = sessionCheckInSchema.safeParse(reading({ accuracy: 150 }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/imprecise/i);
    }
  });

  it("requires an accuracy value so a client cannot omit it", () => {
    expect(
      sessionCheckInSchema.safeParse({ latitude: -6.2, longitude: 106.8 })
        .success,
    ).toBe(false);
  });

  it("rejects unknown fields so a client cannot name a user", () => {
    expect(
      sessionCheckInSchema.safeParse(
        reading({ userId: "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f" }),
      ).success,
    ).toBe(false);
  });
});

describe("sessionCheckInLocationSchema", () => {
  it("defaults the radius to 150 metres", () => {
    const parsed = sessionCheckInLocationSchema.parse({
      latitude: -6.2,
      longitude: 106.8,
    });

    expect(parsed.radiusM).toBe(150);
  });

  it("rejects a radius outside the supported range", () => {
    expect(
      sessionCheckInLocationSchema.safeParse({
        latitude: -6.2,
        longitude: 106.8,
        radiusM: 10,
      }).success,
    ).toBe(false);
    expect(
      sessionCheckInLocationSchema.safeParse({
        latitude: -6.2,
        longitude: 106.8,
        radiusM: 2_000,
      }).success,
    ).toBe(false);
  });

  it("rejects a fractional radius", () => {
    expect(
      sessionCheckInLocationSchema.safeParse({
        latitude: -6.2,
        longitude: 106.8,
        radiusM: 75.5,
      }).success,
    ).toBe(false);
  });
});

describe("sessionCheckInReviewSchema", () => {
  it("accepts every attendance status", () => {
    for (const status of ["present", "late", "excused", "absent"]) {
      expect(sessionCheckInReviewSchema.safeParse({ status }).success).toBe(
        true,
      );
    }
  });

  it("rejects a status outside the four", () => {
    expect(
      sessionCheckInReviewSchema.safeParse({ status: "attending" }).success,
    ).toBe(false);
  });

  it("treats an empty note as no note", () => {
    const parsed = sessionCheckInReviewSchema.parse({
      status: "excused",
      note: "   ",
    });

    expect(parsed.note).toBeUndefined();
  });

  it("rejects a note that is too long", () => {
    expect(
      sessionCheckInReviewSchema.safeParse({
        status: "excused",
        note: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe("sessionCheckInRecordSchema", () => {
  it("accepts a member and a status", () => {
    expect(
      sessionCheckInRecordSchema.safeParse({
        userId: MEMBER_ID,
        status: "absent",
      }).success,
    ).toBe(true);
  });

  it("requires a real uuid instead of a name", () => {
    expect(
      sessionCheckInRecordSchema.safeParse({
        userId: "Andi",
        status: "present",
      }).success,
    ).toBe(false);
  });

  it("rejects a status outside the four", () => {
    expect(
      sessionCheckInRecordSchema.safeParse({
        userId: MEMBER_ID,
        status: "attending",
      }).success,
    ).toBe(false);
  });

  it("turns an empty note into no note", () => {
    const parsed = sessionCheckInRecordSchema.parse({
      userId: MEMBER_ID,
      status: "present",
      note: "  ",
    });

    expect(parsed.note).toBeUndefined();
  });

  it("rejects unknown fields so a client cannot set the method", () => {
    expect(
      sessionCheckInRecordSchema.safeParse({
        userId: MEMBER_ID,
        status: "present",
        method: "geo",
      }).success,
    ).toBe(false);
  });
});

describe("getSessionCheckInWindow", () => {
  it("opens fifteen minutes before the session and closes at the end", () => {
    const window = getSessionCheckInWindow(STARTS_AT, ENDS_AT);

    expect(window).not.toBeNull();
    expect(window?.opensAt).toBe(Date.parse(STARTS_AT) - 15 * 60 * 1_000);
    expect(window?.closesAt).toBe(Date.parse(ENDS_AT));
  });

  it("returns null for an unparseable timestamp", () => {
    expect(getSessionCheckInWindow("soon", ENDS_AT)).toBeNull();
  });
});

describe("getSessionCheckInWindowState", () => {
  it("is before, open, then closed around the session", () => {
    expect(
      getSessionCheckInWindowState(
        STARTS_AT,
        ENDS_AT,
        Date.parse(STARTS_AT) - 20 * 60 * 1_000,
      ),
    ).toBe("before");
    expect(
      getSessionCheckInWindowState(STARTS_AT, ENDS_AT, Date.parse(STARTS_AT)),
    ).toBe("open");
    expect(
      getSessionCheckInWindowState(STARTS_AT, ENDS_AT, Date.parse(ENDS_AT) + 1),
    ).toBe("closed");
  });

  it("treats an unparseable schedule as closed", () => {
    expect(getSessionCheckInWindowState("soon", ENDS_AT, Date.now())).toBe(
      "closed",
    );
  });
});
