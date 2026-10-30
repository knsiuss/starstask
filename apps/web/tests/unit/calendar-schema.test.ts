import { describe, expect, it } from "vitest";

import {
  calendarEventStatusSchema,
  calendarQuerySchema,
  classCalendarEventCreateSchema,
  personalCalendarEventCreateSchema,
} from "@starstask/contracts";

const startsAt = "2026-10-30T09:00:00+07:00";
const endsAt = "2026-10-30T10:00:00+07:00";

describe("calendarQuerySchema", () => {
  it("applies month and all-event defaults", () => {
    const parsed = calendarQuerySchema.parse({});

    expect(parsed.view).toBe("month");
    expect(parsed.type).toBe("all");
  });

  it("keeps valid filters and strips unrelated query keys", () => {
    const parsed = calendarQuerySchema.parse({
      view: "week",
      date: "2026-10-30",
      type: "exam",
      utm_source: "ignored",
    });

    expect(parsed).toEqual({
      view: "week",
      date: "2026-10-30",
      type: "exam",
    });
  });

  it("rejects an unknown view", () => {
    expect(calendarQuerySchema.safeParse({ view: "year" }).success).toBe(false);
  });

  it("rejects a class filter that is not a uuid", () => {
    expect(calendarQuerySchema.safeParse({ class: "matkul" }).success).toBe(
      false,
    );
  });
});

describe("personalCalendarEventCreateSchema", () => {
  const valid = {
    title: "Study for the exam",
    startsAt,
    endsAt,
    timeZone: "Asia/Jakarta",
    location: "Library",
    description: "Chapters 4 and 5",
  };

  it("accepts a valid personal event", () => {
    expect(personalCalendarEventCreateSchema.safeParse(valid).success).toBe(
      true,
    );
  });

  it("normalizes blank optional text to undefined", () => {
    const parsed = personalCalendarEventCreateSchema.parse({
      ...valid,
      location: "   ",
      description: null,
    });

    expect(parsed.location).toBeUndefined();
    expect(parsed.description).toBeUndefined();
  });

  it("rejects an end time before the start time", () => {
    const result = personalCalendarEventCreateSchema.safeParse({
      ...valid,
      endsAt: "2026-10-30T08:00:00+07:00",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an event longer than thirty days", () => {
    const result = personalCalendarEventCreateSchema.safeParse({
      ...valid,
      endsAt: "2026-12-30T10:00:00+07:00",
    });

    expect(result.success).toBe(false);
  });
});

describe("classCalendarEventCreateSchema", () => {
  const valid = {
    title: "Midterm exam",
    startsAt,
    endsAt,
    timeZone: "Asia/Jakarta",
    eventType: "exam",
  };

  it("accepts an official exam", () => {
    expect(classCalendarEventCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an assignment type because deadlines come from assignments", () => {
    expect(
      classCalendarEventCreateSchema.safeParse({
        ...valid,
        eventType: "assignment",
      }).success,
    ).toBe(false);
  });

  it("converts a null subject to undefined", () => {
    const parsed = classCalendarEventCreateSchema.parse({
      ...valid,
      subjectId: null,
    });

    expect(parsed.subjectId).toBeUndefined();
  });
});

describe("calendarEventStatusSchema", () => {
  it("accepts the three lifecycle states", () => {
    for (const status of ["published", "cancelled", "archived"] as const) {
      expect(calendarEventStatusSchema.safeParse({ status }).success).toBe(
        true,
      );
    }
  });

  it("rejects an unknown status", () => {
    expect(
      calendarEventStatusSchema.safeParse({ status: "deleted" }).success,
    ).toBe(false);
  });
});
