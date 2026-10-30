import { describe, expect, it } from "vitest";

import {
  isSessionOpenForRsvp,
  isSessionUpcoming,
  sessionCreateSchema,
  sessionListQuerySchema,
  sessionRsvpSchema,
  sessionStatusUpdateSchema,
  sessionUpdateSchema,
} from "@starstask/contracts";

const CLASS_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";

function baseInput(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    classId: CLASS_ID,
    title: "Midterm review",
    description: "Walk through the past papers together.",
    sessionType: "online",
    meetingUrl: "https://meet.example.com/abc-defg-hij",
    startsAt: "2026-11-05T12:00:00.000Z",
    endsAt: "2026-11-05T14:00:00.000Z",
    timeZone: "Asia/Jakarta",
    ...overrides,
  };
}

describe("sessionCreateSchema", () => {
  it("accepts a minimal online session", () => {
    const result = sessionCreateSchema.safeParse(baseInput());

    expect(result.success).toBe(true);
  });

  it("defaults visibility and session type so the form can omit them", () => {
    const result = sessionCreateSchema.parse(
      baseInput({ sessionType: undefined, visibility: undefined }),
    );

    expect(result.sessionType).toBe("online");
    expect(result.visibility).toBe("class_members");
  });

  it("rejects a session that ends before it starts", () => {
    const result = sessionCreateSchema.safeParse(
      baseInput({ endsAt: "2026-11-05T11:00:00.000Z" }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["endsAt"]);
    }
  });

  it("rejects a session longer than 24 hours", () => {
    const result = sessionCreateSchema.safeParse(
      baseInput({ endsAt: "2026-11-07T12:00:00.000Z" }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/24 hours/);
    }
  });

  it("rejects a registration deadline after the start", () => {
    const result = sessionCreateSchema.safeParse(
      baseInput({ registrationDeadline: "2026-11-05T13:00:00.000Z" }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["registrationDeadline"]);
    }
  });

  it("requires a meeting link for an online session", () => {
    const result = sessionCreateSchema.safeParse(
      baseInput({ meetingUrl: undefined }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["meetingUrl"]);
    }
  });

  it("requires a location for an in-person session", () => {
    const result = sessionCreateSchema.safeParse(
      baseInput({ sessionType: "in_person", meetingUrl: undefined }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["location"]);
    }
  });

  it("accepts an in-person session with a location", () => {
    const result = sessionCreateSchema.safeParse(
      baseInput({
        sessionType: "in_person",
        meetingUrl: undefined,
        location: "Room 3.14, Faculty of Computer Science",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects a non-https meeting link", () => {
    const result = sessionCreateSchema.safeParse(
      baseInput({ meetingUrl: "javascript:alert(1)" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects an unknown time zone", () => {
    const result = sessionCreateSchema.safeParse(
      baseInput({ timeZone: "Mars/Olympus" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a capacity outside the allowed range", () => {
    expect(
      sessionCreateSchema.safeParse(baseInput({ capacity: 0 })).success,
    ).toBe(false);
    expect(
      sessionCreateSchema.safeParse(baseInput({ capacity: 1_001 })).success,
    ).toBe(false);
    expect(
      sessionCreateSchema.safeParse(baseInput({ capacity: 30 })).success,
    ).toBe(true);
  });

  it("rejects unknown fields so a client cannot smuggle a status", () => {
    const result = sessionCreateSchema.safeParse(
      baseInput({ status: "completed", organizerId: CLASS_ID }),
    );

    expect(result.success).toBe(false);
  });
});

describe("sessionUpdateSchema", () => {
  it("does not require a class id", () => {
    const result = sessionUpdateSchema.safeParse({
      title: "Moved review",
      description: "Same content, new room.",
      sessionType: "in_person",
      location: "Room 2.01",
      startsAt: "2026-11-06T12:00:00.000Z",
      endsAt: "2026-11-06T13:00:00.000Z",
      timeZone: "Asia/Jakarta",
    });

    expect(result.success).toBe(true);
  });

  it("still enforces the cross-field rules", () => {
    const result = sessionUpdateSchema.safeParse({
      title: "Moved review",
      description: "Same content, new room.",
      sessionType: "in_person",
      startsAt: "2026-11-06T12:00:00.000Z",
      endsAt: "2026-11-06T11:00:00.000Z",
      timeZone: "Asia/Jakarta",
    });

    expect(result.success).toBe(false);
  });
});

describe("sessionRsvpSchema and sessionStatusUpdateSchema", () => {
  it("accepts the three RSVP statuses only", () => {
    for (const status of ["going", "maybe", "not_going"]) {
      expect(sessionRsvpSchema.safeParse({ status }).success).toBe(true);
    }

    expect(sessionRsvpSchema.safeParse({ status: "attending" }).success).toBe(
      false,
    );
  });

  it("rejects an RSVP body that tries to name a user", () => {
    expect(
      sessionRsvpSchema.safeParse({ status: "going", userId: CLASS_ID })
        .success,
    ).toBe(false);
  });

  it("accepts the three session statuses only", () => {
    for (const status of ["scheduled", "cancelled", "completed"]) {
      expect(sessionStatusUpdateSchema.safeParse({ status }).success).toBe(
        true,
      );
    }

    expect(
      sessionStatusUpdateSchema.safeParse({ status: "deleted" }).success,
    ).toBe(false);
  });
});

describe("sessionListQuerySchema", () => {
  it("defaults to the upcoming list view", () => {
    const result = sessionListQuerySchema.parse({});

    expect(result.status).toBe("upcoming");
    expect(result.view).toBe("list");
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(24);
  });

  it("coerces paging from the query string", () => {
    const result = sessionListQuerySchema.parse({ page: "3", pageSize: "12" });

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(12);
  });

  it("rejects a class filter that is not a UUID", () => {
    expect(
      sessionListQuerySchema.safeParse({ class: "algorithms" }).success,
    ).toBe(false);
  });

  it("rejects an unknown view", () => {
    expect(sessionListQuerySchema.safeParse({ view: "grid" }).success).toBe(
      false,
    );
  });
});

describe("isSessionOpenForRsvp", () => {
  const now = Date.parse("2026-11-05T10:00:00.000Z");

  const session = {
    status: "scheduled" as const,
    startsAt: "2026-11-05T12:00:00.000Z",
    registrationDeadline: null as string | null,
  };

  it("is open while the session is scheduled and in the future", () => {
    expect(isSessionOpenForRsvp(session, now)).toBe(true);
  });

  it("is closed once the session started", () => {
    expect(
      isSessionOpenForRsvp(session, Date.parse("2026-11-05T12:00:01.000Z")),
    ).toBe(false);
  });

  it("is closed for a cancelled or completed session", () => {
    expect(isSessionOpenForRsvp({ ...session, status: "cancelled" }, now)).toBe(
      false,
    );
    expect(isSessionOpenForRsvp({ ...session, status: "completed" }, now)).toBe(
      false,
    );
  });

  it("is closed once the registration deadline passed", () => {
    expect(
      isSessionOpenForRsvp(
        { ...session, registrationDeadline: "2026-11-05T09:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("treats an unparseable start as closed rather than open", () => {
    expect(isSessionOpenForRsvp({ ...session, startsAt: "soon" }, now)).toBe(
      false,
    );
  });
});

describe("isSessionUpcoming", () => {
  const now = Date.parse("2026-11-05T10:00:00.000Z");

  it("counts a scheduled session that has not finished", () => {
    expect(
      isSessionUpcoming(
        { status: "scheduled", endsAt: "2026-11-05T11:00:00.000Z" },
        now,
      ),
    ).toBe(true);
  });

  it("drops a cancelled session even if its end time is in the future", () => {
    expect(
      isSessionUpcoming(
        { status: "cancelled", endsAt: "2026-11-05T11:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("drops a finished session", () => {
    expect(
      isSessionUpcoming(
        { status: "scheduled", endsAt: "2026-11-05T09:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });
});
