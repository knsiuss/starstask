import { describe, expect, it } from "vitest";

import {
  classScheduleBatchCreateSchema,
  classScheduleCreateSchema,
  classScheduleUpdateSchema,
} from "@starstask/contracts";

const validCreate = {
  subjectId: "9b2f4a1e-1111-4222-8333-444455556666",
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "10:00",
};

describe("classScheduleCreateSchema", () => {
  it("accepts a valid slot and normalizes empty optional text", () => {
    const parsed = classScheduleCreateSchema.parse({
      ...validCreate,
      room: "  ",
      lecturerName: "Budi Santoso",
    });

    expect(parsed.room).toBeUndefined();
    expect(parsed.lecturerName).toBe("Budi Santoso");
  });

  it("rejects a day outside Monday..Sunday", () => {
    const result = classScheduleCreateSchema.safeParse({
      ...validCreate,
      dayOfWeek: 8,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed time", () => {
    const result = classScheduleCreateSchema.safeParse({
      ...validCreate,
      startTime: "8am",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an end time that is not after the start time", () => {
    const result = classScheduleCreateSchema.safeParse({
      ...validCreate,
      endTime: "08:00",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown keys", () => {
    const result = classScheduleCreateSchema.safeParse({
      ...validCreate,
      extra: true,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a semester range from a timetable import", () => {
    const parsed = classScheduleCreateSchema.parse({
      ...validCreate,
      period: "1",
      startDate: "2026-08-31",
      endDate: "2027-01-31",
    });

    expect(parsed.period).toBe("1");
    expect(parsed.startDate).toBe("2026-08-31");
    expect(parsed.endDate).toBe("2027-01-31");
  });

  it("rejects an end date before the start date", () => {
    const result = classScheduleCreateSchema.safeParse({
      ...validCreate,
      startDate: "2027-01-31",
      endDate: "2026-08-31",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed semester date", () => {
    const result = classScheduleCreateSchema.safeParse({
      ...validCreate,
      startDate: "31 Agt 2026",
    });

    expect(result.success).toBe(false);
  });
});

describe("classScheduleBatchCreateSchema", () => {
  it("accepts a batch of valid rows", () => {
    const parsed = classScheduleBatchCreateSchema.parse([
      validCreate,
      { ...validCreate, dayOfWeek: 3 },
    ]);

    expect(parsed).toHaveLength(2);
  });

  it("rejects an empty batch and one bad row", () => {
    expect(classScheduleBatchCreateSchema.safeParse([]).success).toBe(false);
    expect(
      classScheduleBatchCreateSchema.safeParse([
        validCreate,
        { ...validCreate, endTime: "07:00" },
      ]).success,
    ).toBe(false);
  });
});

describe("classScheduleUpdateSchema", () => {
  it("accepts a full replacement payload", () => {
    const parsed = classScheduleUpdateSchema.parse({
      subjectId: "9b2f4a1e-1111-4222-8333-444455556666",
      dayOfWeek: 5,
      startTime: "13:00",
      endTime: "15:30",
      room: "Lab 2",
      lecturerName: null,
    });

    expect(parsed.room).toBe("Lab 2");
    expect(parsed.lecturerName).toBeUndefined();
  });
});
