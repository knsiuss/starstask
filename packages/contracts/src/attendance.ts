import { z } from "zod";

import { isoDateSchema } from "./leave";
import { SESSION_CHECKIN_STATUSES } from "./sessions";

/**
 * What a student sees for one class session.
 *
 * The four recorded statuses come from the existing check-in model. The other
 * two are view states, not stored values: `pending` means the session has not
 * finished yet, and `unrecorded` means it finished without a row. Missing
 * records are never treated as present.
 */
export const ATTENDANCE_DISPLAY_STATUSES = [
  ...SESSION_CHECKIN_STATUSES,
  "pending",
  "unrecorded",
] as const;

export type AttendanceDisplayStatus =
  (typeof ATTENDANCE_DISPLAY_STATUSES)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceDisplayStatus, string> =
  {
    present: "Present",
    late: "Late",
    excused: "Excused",
    absent: "Absent",
    pending: "Pending",
    unrecorded: "Not recorded",
  };

export const ATTENDANCE_FILTER_STATUSES = [
  "all",
  ...ATTENDANCE_DISPLAY_STATUSES,
] as const;

export type AttendanceFilterStatus =
  (typeof ATTENDANCE_FILTER_STATUSES)[number];

export const attendanceQuerySchema = z
  .object({
    class: z.uuid("Invalid class id").optional(),
    subject: z.uuid("Invalid subject id").optional(),
    year: z.string().trim().min(4).max(9).optional(),
    semester: z.string().trim().min(1).max(40).optional(),
    status: z.enum(ATTENDANCE_FILTER_STATUSES).default("all"),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine(
    (value) =>
      !value.from ||
      !value.to ||
      Date.parse(`${value.from}T00:00:00Z`) <=
        Date.parse(`${value.to}T00:00:00Z`),
    {
      message: "The end date cannot be before the start date",
      path: ["to"],
    },
  );

export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

/** True when the status represents a stored attendance row. */
export function isRecordedAttendanceStatus(
  status: AttendanceDisplayStatus,
): boolean {
  return (
    status === "present" ||
    status === "late" ||
    status === "excused" ||
    status === "absent"
  );
}
