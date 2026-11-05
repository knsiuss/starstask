import { z } from "zod";

import { isoDateTimeWithOffsetSchema } from "./assignment";
import { isoDateSchema } from "./leave";
import {
  CHECKIN_POSITION_MAX_AGE_MS,
  SESSION_CHECKIN_ACCURACY_MAX_M,
} from "./sessions";

/**
 * Status of one student in one meeting.
 *
 * `not_recorded` is the view state of an open or closed-but-not-finalized
 * meeting, and `not_applicable` marks a member who joined after the meeting.
 * Neither is ever written to the database as an absence.
 */
export const ATTENDANCE_MEETING_CELL_STATUSES = [
  "present",
  "late",
  "excused",
  "sick",
  "absent",
  "not_recorded",
  "not_applicable",
] as const;

export type AttendanceMeetingCellStatus =
  (typeof ATTENDANCE_MEETING_CELL_STATUSES)[number];

export const ATTENDANCE_MEETING_CELL_LABELS: Record<
  AttendanceMeetingCellStatus,
  string
> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  sick: "Sick",
  absent: "Absent",
  not_recorded: "Not recorded",
  not_applicable: "Not applicable",
};

/** Symbols used by the semester recap: P / L / I / S / A / NR. */
export const ATTENDANCE_MEETING_CELL_SYMBOLS: Record<
  AttendanceMeetingCellStatus,
  string
> = {
  present: "P",
  late: "L",
  excused: "I",
  sick: "S",
  absent: "A",
  not_recorded: "NR",
  not_applicable: "—",
};

export const ATTENDANCE_MEETING_PHASES = [
  "scheduled",
  "open",
  "closed",
  "finalized",
] as const;

export type AttendanceMeetingPhase = (typeof ATTENDANCE_MEETING_PHASES)[number];

export const ATTENDANCE_MEETING_PHASE_LABELS: Record<
  AttendanceMeetingPhase,
  string
> = {
  scheduled: "Not opened",
  open: "Open",
  closed: "Closed",
  finalized: "Finalized",
};

export const ATTENDANCE_MEETING_RADIUS_MIN = 25;
export const ATTENDANCE_MEETING_RADIUS_MAX = 500;
export const ATTENDANCE_MEETING_RADIUS_DEFAULT = 200;

export const ATTENDANCE_MEETING_TITLE_MAX = 160;
export const ATTENDANCE_MEETING_LOCATION_MAX = 200;
export const ATTENDANCE_MEETING_NUMBER_MAX = 999;
export const ATTENDANCE_MEETING_LATE_MIN = 0;
export const ATTENDANCE_MEETING_LATE_MAX = 240;
export const ATTENDANCE_MEETING_LOCATION_REASON_MAX = 500;
export const ATTENDANCE_MEETING_NAME_MAX = 80;
export const ATTENDANCE_MEETING_NIM_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;

export const attendanceMeetingCreateSchema = z
  .object({
    classId: z.uuid("Choose a class"),
    subjectId: z.uuid("Choose a subject"),
    meetingNumber: z.coerce
      .number()
      .int("Meeting number must be a whole number")
      .min(1, "Meeting number must be at least 1")
      .max(
        ATTENDANCE_MEETING_NUMBER_MAX,
        `Meeting number must be at most ${ATTENDANCE_MEETING_NUMBER_MAX}`,
      ),
    meetingDate: isoDateSchema,
    startsAt: isoDateTimeWithOffsetSchema,
    endsAt: isoDateTimeWithOffsetSchema,
    opensAt: isoDateTimeWithOffsetSchema.optional().nullable(),
    closesAt: isoDateTimeWithOffsetSchema.optional().nullable(),
    location: z
      .string()
      .trim()
      .min(3, "Location must be at least 3 characters")
      .max(
        ATTENDANCE_MEETING_LOCATION_MAX,
        `Location must be ${ATTENDANCE_MEETING_LOCATION_MAX} characters or fewer`,
      ),
    lateAfterMinutes: z.coerce
      .number()
      .int("The late deadline must be a whole number of minutes")
      .min(ATTENDANCE_MEETING_LATE_MIN)
      .max(ATTENDANCE_MEETING_LATE_MAX)
      .default(10),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    radiusM: z.coerce
      .number()
      .int("Radius must be a whole number of metres")
      .min(
        ATTENDANCE_MEETING_RADIUS_MIN,
        `Radius must be at least ${ATTENDANCE_MEETING_RADIUS_MIN} metres`,
      )
      .max(
        ATTENDANCE_MEETING_RADIUS_MAX,
        `Radius must be at most ${ATTENDANCE_MEETING_RADIUS_MAX} metres`,
      )
      .default(ATTENDANCE_MEETING_RADIUS_DEFAULT),
    title: z
      .string()
      .trim()
      .max(
        ATTENDANCE_MEETING_TITLE_MAX,
        `Title must be ${ATTENDANCE_MEETING_TITLE_MAX} characters or fewer`,
      )
      .optional()
      .nullable()
      .transform((value) =>
        value === "" || value === null ? undefined : value,
      ),
  })
  .strict()
  .superRefine((value, context) => {
    const startsAt = Date.parse(value.startsAt);
    const endsAt = Date.parse(value.endsAt);

    if (Number.isFinite(startsAt) && Number.isFinite(endsAt)) {
      if (endsAt <= startsAt) {
        context.addIssue({
          code: "custom",
          message: "The meeting must end after it starts",
          path: ["endsAt"],
        });
      } else if (endsAt - startsAt > 24 * 60 * 60 * 1_000) {
        context.addIssue({
          code: "custom",
          message: "A meeting cannot last longer than 24 hours",
          path: ["endsAt"],
        });
      }

      if (value.opensAt && value.closesAt) {
        const opensAt = Date.parse(value.opensAt);
        const closesAt = Date.parse(value.closesAt);

        if (
          Number.isFinite(opensAt) &&
          Number.isFinite(closesAt) &&
          closesAt <= opensAt
        ) {
          context.addIssue({
            code: "custom",
            message: "Attendance must close after it opens",
            path: ["closesAt"],
          });
        }
      }
    }

    const hasLatitude = value.latitude !== null && value.latitude !== undefined;
    const hasLongitude =
      value.longitude !== null && value.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: "custom",
        message: "Provide both coordinates or neither",
        path: ["latitude"],
      });
    }
  });

export type AttendanceMeetingCreateInput = z.infer<
  typeof attendanceMeetingCreateSchema
>;

export const attendanceMeetingCheckInSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name")
      .max(
        ATTENDANCE_MEETING_NAME_MAX,
        `Your name must be ${ATTENDANCE_MEETING_NAME_MAX} characters or fewer`,
      ),
    nim: z
      .string()
      .trim()
      .regex(ATTENDANCE_MEETING_NIM_PATTERN, "Enter a valid NIM"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z
      .number()
      .min(0)
      .max(
        SESSION_CHECKIN_ACCURACY_MAX_M,
        "Your location is too imprecise. Move somewhere with a clearer signal and try again",
      ),
    capturedAt: z
      .number()
      .int("Timestamp must be a whole number of milliseconds")
      .optional()
      .refine(
        (value) =>
          value === undefined ||
          value <= Date.now() + CHECKIN_POSITION_MAX_AGE_MS,
        "Your location timestamp is not valid",
      )
      .refine(
        (value) =>
          value === undefined ||
          value >= Date.now() - CHECKIN_POSITION_MAX_AGE_MS,
        "Your location is stale. Move somewhere with a clearer signal and try again",
      ),
  })
  .strict();

export type AttendanceMeetingCheckInInput = z.infer<
  typeof attendanceMeetingCheckInSchema
>;

export const attendanceMeetingLocationChangeSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusM: z.coerce
      .number()
      .int()
      .min(ATTENDANCE_MEETING_RADIUS_MIN)
      .max(ATTENDANCE_MEETING_RADIUS_MAX),
    reason: z
      .string()
      .trim()
      .min(3, "Explain why the location is changing")
      .max(ATTENDANCE_MEETING_LOCATION_REASON_MAX),
  })
  .strict();

export type AttendanceMeetingLocationChangeInput = z.infer<
  typeof attendanceMeetingLocationChangeSchema
>;

export const attendanceMeetingCloseSchema = z
  .object({
    finalize: z.boolean().default(true),
  })
  .strict();

export type AttendanceMeetingCloseInput = z.infer<
  typeof attendanceMeetingCloseSchema
>;

export const ATTENDANCE_CORRECTION_REASON_MIN = 3;
export const ATTENDANCE_CORRECTION_REASON_MAX = 500;

export const attendanceMeetingCorrectionSchema = z
  .object({
    userId: z.uuid("Choose a student"),
    status: z.enum(
      ["present", "late", "excused", "sick", "absent"],
      "Choose a status",
    ),
    reason: z
      .string()
      .trim()
      .min(
        ATTENDANCE_CORRECTION_REASON_MIN,
        `A correction reason of at least ${ATTENDANCE_CORRECTION_REASON_MIN} characters is required`,
      )
      .max(ATTENDANCE_CORRECTION_REASON_MAX),
    /**
     * Attestation that the admin physically saw the student in the attendance
     * area. Required whenever the correction marks the member present; the
     * server enforces the same rule.
     */
    physicallyVerified: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "present" && !value.physicallyVerified) {
      context.addIssue({
        code: "custom",
        message:
          "Confirm that you physically verified the student at the attendance location",
        path: ["physicallyVerified"],
      });
    }
  });

export type AttendanceMeetingCorrectionInput = z.infer<
  typeof attendanceMeetingCorrectionSchema
>;

export const COURSE_GRADE_COMPONENTS = ["tugas", "uts", "uas"] as const;

export type CourseGradeComponent = (typeof COURSE_GRADE_COMPONENTS)[number];

export const courseComponentGradeSchema = z
  .object({
    studentId: z.uuid("Choose a student"),
    component: z.enum(COURSE_GRADE_COMPONENTS),
    score: z.coerce
      .number()
      .min(0, "Score must be at least 0")
      .max(100, "Score must be at most 100"),
  })
  .strict();

export type CourseComponentGradeInput = z.infer<
  typeof courseComponentGradeSchema
>;

export const attendanceExportKindSchema = z.enum([
  "meeting",
  "recap",
  "template",
  "report",
]);

export type AttendanceExportKind = z.infer<typeof attendanceExportKindSchema>;

type MeetingPhaseInput = {
  attendance_opened_at: string | null;
  attendance_closed_at: string | null;
  attendance_finalized_at: string | null;
  attendance_closes_at?: string | null;
  ends_at: string;
};

/**
 * Derives the visible phase. The database still decides whether a check-in is
 * accepted; this only drives labels and buttons.
 */
export function resolveAttendanceMeetingPhase(
  meeting: MeetingPhaseInput,
  nowMs: number,
): AttendanceMeetingPhase {
  if (meeting.attendance_finalized_at) {
    return "finalized";
  }

  if (meeting.attendance_closed_at) {
    return "closed";
  }

  if (!meeting.attendance_opened_at) {
    return "scheduled";
  }

  const closesAt = Date.parse(meeting.attendance_closes_at ?? meeting.ends_at);

  if (Number.isFinite(closesAt) && nowMs > closesAt) {
    return "closed";
  }

  return "open";
}

/** The instant after which a check-in counts as late. */
export function getAttendanceLateDeadline(
  startsAt: string,
  lateAfterMinutes: number,
): number | null {
  const start = Date.parse(startsAt);

  if (!Number.isFinite(start)) {
    return null;
  }

  return start + Math.max(0, lateAfterMinutes) * 60 * 1_000;
}
