import { z } from "zod";

/**
 * Zod schemas for the Phase 5I academic domains (identity, structure,
 * enrollment, attendance, announcements, grading).
 *
 * Bounds mirror the CHECK constraints in supabase/migrations/2026111*.sql so
 * invalid payloads are rejected at the edge with the same limits the database
 * enforces. Nothing here grants authority: every route re-verifies the
 * caller server-side.
 */

export const ACADEMIC_YEAR_STATUSES = [
  "planned",
  "open",
  "closed",
  "archived",
] as const;
export const academicYearStatusSchema = z.enum(ACADEMIC_YEAR_STATUSES);
export type AcademicYearStatus = z.infer<typeof academicYearStatusSchema>;

export const academicYearCreateSchema = z
  .object({
    code: z.string().trim().min(1, "Code is required").max(40),
    name: z.string().trim().min(2, "Name is too short").max(200),
    startDate: z.iso.date("startDate must be a date (YYYY-MM-DD)"),
    endDate: z.iso.date("endDate must be a date (YYYY-MM-DD)"),
    status: academicYearStatusSchema.default("planned"),
    isCurrent: z.boolean().default(false),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "endDate must not be before startDate",
    path: ["endDate"],
  });
export type AcademicYearCreateInput = z.infer<typeof academicYearCreateSchema>;

export const CLASS_ADMIN_PERMISSION_CODES = [
  "manage_admins",
  "manage_attendance",
  "manage_assignments",
  "manage_announcements",
  "manage_grades",
  "manage_schedule",
  "manage_materials",
  "manage_leave_review",
] as const;
export const classAdminPermissionCodeSchema = z.enum(
  CLASS_ADMIN_PERMISSION_CODES,
);
export type ClassAdminPermissionCode = z.infer<
  typeof classAdminPermissionCodeSchema
>;

export const classAdminGrantSchema = z
  .object({
    userId: z.uuid().optional(),
    studentIdentityId: z.uuid().optional(),
    permissionCodes: z
      .array(classAdminPermissionCodeSchema)
      .min(1, "Select at least one permission")
      .max(CLASS_ADMIN_PERMISSION_CODES.length),
  })
  .refine(
    (value) => Boolean(value.userId) !== Boolean(value.studentIdentityId),
    {
      message: "Provide exactly one of userId or studentIdentityId",
      path: ["userId"],
    },
  );
export type ClassAdminGrantInput = z.infer<typeof classAdminGrantSchema>;

export const ATTENDANCE_RECORD_STATUSES = [
  "present",
  "late",
  "excused",
  "sick",
  "absent",
] as const;
export const attendanceRecordStatusSchema = z.enum(ATTENDANCE_RECORD_STATUSES);
export type AttendanceRecordStatus = z.infer<
  typeof attendanceRecordStatusSchema
>;

export const ATTENDANCE_MEETING_STATUSES = [
  "scheduled",
  "open",
  "closed",
  "cancelled",
] as const;
export const attendanceMeetingStatusSchema = z.enum(
  ATTENDANCE_MEETING_STATUSES,
);
export type AttendanceMeetingStatus = z.infer<
  typeof attendanceMeetingStatusSchema
>;

export const normalizedAttendanceMeetingCreateSchema = z.object({
  offeringId: z.uuid(),
  scheduledAt: z.iso.datetime({ offset: true }),
  status: attendanceMeetingStatusSchema.default("scheduled"),
  location: z.string().trim().min(1).max(200).nullish(),
});
export type NormalizedAttendanceMeetingCreateInput = z.infer<
  typeof normalizedAttendanceMeetingCreateSchema
>;

export const attendanceRosterRecordSchema = z.object({
  studentIdentityId: z.uuid(),
  status: attendanceRecordStatusSchema,
});
export type AttendanceRosterRecordInput = z.infer<
  typeof attendanceRosterRecordSchema
>;

export const attendanceRosterUpsertSchema = z.object({
  meetingId: z.uuid(),
  entries: z
    .array(attendanceRosterRecordSchema)
    .min(1, "Record at least one student")
    .max(300, "Too many rows in one request"),
});
export type AttendanceRosterUpsertInput = z.infer<
  typeof attendanceRosterUpsertSchema
>;

export const attendanceCorrectionSchema = z.object({
  recordId: z.uuid(),
  newStatus: attendanceRecordStatusSchema,
  reason: z.string().trim().min(3, "Reason is too short").max(2000),
});
export type AttendanceCorrectionInput = z.infer<
  typeof attendanceCorrectionSchema
>;

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(200),
  body: z.string().trim().min(1, "Body is required").max(20000),
  offeringId: z.uuid().nullish(),
  pinned: z.boolean().default(false),
  publish: z.boolean().default(true),
});
export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;

export const announcementUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    pinned: z.boolean().optional(),
    publish: z.boolean().optional(),
    archive: z.boolean().optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "Provide at least one field to update",
    },
  );
export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;
