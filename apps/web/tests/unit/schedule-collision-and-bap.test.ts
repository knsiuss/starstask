import { describe, expect, it } from "vitest";

import {
  attendanceMeetingBapUpdateSchema,
  attendanceMeetingCloseSchema,
} from "@starstask/contracts";

import {
  calculateOfferingBapProgress,
  summarizeBapProgress,
} from "@/lib/lecturer/bap-progress";
import {
  findScheduleCollisions,
  hasTimeSlotCollision,
  hasTimeSlotOverlap,
} from "@/lib/schedule/collision";

describe("schedule time-slot collision", () => {
  it("detects overlapping intervals and allows adjacent boundaries", () => {
    expect(hasTimeSlotOverlap("08:00", "10:00", "09:00", "11:00")).toBe(true);
    expect(hasTimeSlotOverlap("08:00", "10:00", "08:00", "10:00")).toBe(true);
    expect(hasTimeSlotOverlap("08:00", "10:00", "10:00", "12:00")).toBe(false);
    expect(hasTimeSlotOverlap("10:00", "12:00", "08:00", "10:00")).toBe(false);
  });

  it("detects same-class collisions on the same day", () => {
    const existing = {
      id: "slot-1",
      classId: "class-a",
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "10:00",
      room: "R301",
    };

    expect(
      hasTimeSlotCollision(
        {
          classId: "class-a",
          dayOfWeek: 1,
          startTime: "09:30",
          endTime: "11:00",
        },
        existing,
      ),
    ).toBe(true);

    expect(
      hasTimeSlotCollision(
        {
          classId: "class-a",
          dayOfWeek: 2,
          startTime: "09:30",
          endTime: "11:00",
        },
        existing,
      ),
    ).toBe(false);

    expect(
      hasTimeSlotCollision(
        {
          id: "slot-1",
          classId: "class-a",
          dayOfWeek: 1,
          startTime: "08:00",
          endTime: "10:00",
        },
        existing,
      ),
    ).toBe(false);
  });

  it("detects room and lecturer collisions across different classes", () => {
    const existing = [
      {
        id: "slot-1",
        classId: "class-a",
        dayOfWeek: 3,
        startTime: "13:00",
        endTime: "15:00",
        room: " Lab 2 ",
        lecturerName: "Dr. Budi",
      },
    ];

    expect(
      findScheduleCollisions(
        {
          classId: "class-b",
          dayOfWeek: 3,
          startTime: "14:00",
          endTime: "16:00",
          room: "lab 2",
        },
        existing,
      ),
    ).toHaveLength(1);

    expect(
      findScheduleCollisions(
        {
          classId: "class-b",
          dayOfWeek: 3,
          startTime: "14:00",
          endTime: "16:00",
          lecturerName: "dr. budi",
        },
        existing,
      ),
    ).toHaveLength(1);

    expect(
      findScheduleCollisions(
        {
          classId: "class-b",
          dayOfWeek: 3,
          startTime: "14:00",
          endTime: "16:00",
          room: "Lab 5",
          lecturerName: "Dr. Sari",
        },
        existing,
      ),
    ).toHaveLength(0);
  });

  it("ignores collisions when semester date ranges do not overlap", () => {
    expect(
      hasTimeSlotCollision(
        {
          classId: "class-a",
          dayOfWeek: 1,
          startTime: "08:00",
          endTime: "10:00",
          startDate: "2026-09-01",
          endDate: "2026-12-20",
        },
        {
          classId: "class-a",
          dayOfWeek: 1,
          startTime: "08:00",
          endTime: "10:00",
          startDate: "2027-02-01",
          endDate: "2027-06-20",
        },
      ),
    ).toBe(false);
  });
});

describe("BAP contracts and meeting count progress", () => {
  it("validates BAP close and update schemas while keeping close backwards-compatible", () => {
    expect(attendanceMeetingCloseSchema.parse({ finalize: true })).toEqual({
      finalize: true,
    });

    expect(
      attendanceMeetingCloseSchema.parse({
        finalize: true,
        bapTopic: "  Normalisasi Basis Data  ",
        bapNotes: "  ",
      }),
    ).toEqual({
      finalize: true,
      bapTopic: "Normalisasi Basis Data",
      bapNotes: undefined,
    });

    expect(
      attendanceMeetingBapUpdateSchema.safeParse({ bapTopic: "ab" }).success,
    ).toBe(false);

    expect(
      attendanceMeetingBapUpdateSchema.safeParse({
        bapTopic: "Graph Traversal BFS/DFS",
        bapNotes: "Covered adjacency list implementation.",
      }).success,
    ).toBe(true);
  });

  it("calculates meetings held vs target (14-16) and missing BAP topics", () => {
    const progress = calculateOfferingBapProgress({
      offeringId: "off-1",
      classId: "cls-1",
      className: "TI-3A",
      classSlug: "ti-3a",
      courseName: "Algorithms",
      meetings: [
        { status: "closed", bapTopic: "Sorting", targetMeetings: 16 },
        { status: "closed", bapTopic: "", targetMeetings: 16 },
        { status: "open", bapTopic: null, targetMeetings: 16 },
        { status: "scheduled", bapTopic: null, targetMeetings: 16 },
        { status: "cancelled", bapTopic: "Cancelled", targetMeetings: 16 },
      ],
    });

    expect(progress.meetingsHeld).toBe(3);
    expect(progress.meetingsWithBap).toBe(1);
    expect(progress.missingBapCount).toBe(2);
    expect(progress.targetMeetings).toBe(16);
    expect(progress.remainingToTarget).toBe(13);
    expect(progress.isBelowTarget).toBe(true);
    expect(progress.progressPercent).toBe(19);
  });

  it("aggregates BAP summary across offerings", () => {
    const fullMeetings = Array.from({ length: 14 }, (_, index) => ({
      status: "closed",
      bapTopic: `Topic ${index + 1}`,
      targetMeetings: 14,
    }));

    const summary = summarizeBapProgress([
      {
        offeringId: "off-1",
        classId: "cls-1",
        className: "TI-3A",
        classSlug: "ti-3a",
        courseName: "Algorithms",
        meetings: fullMeetings,
      },
      {
        offeringId: "off-2",
        classId: "cls-2",
        className: "TI-3B",
        classSlug: "ti-3b",
        courseName: "Databases",
        meetings: [{ status: "closed", bapTopic: null }],
      },
    ]);

    expect(summary.totalMeetingsHeld).toBe(15);
    expect(summary.totalMeetingsWithBap).toBe(14);
    expect(summary.totalMissingBap).toBe(1);
    expect(summary.belowTargetCount).toBe(1);
    expect(summary.offerings[0]?.courseName).toBe("Databases");
  });
});
