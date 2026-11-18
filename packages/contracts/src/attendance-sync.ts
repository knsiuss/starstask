import { z } from "zod";

export const SYNC_ATTENDANCE_STATUSES = [
  "hadir",
  "izin",
  "sakit",
  "alpa",
] as const;

export const syncAttendanceStatusSchema = z.enum(SYNC_ATTENDANCE_STATUSES);

export type SyncAttendanceStatus = z.infer<typeof syncAttendanceStatusSchema>;

export const syncStudentRecordSchema = z.object({
  nim: z.string().max(64).nullable(),
  displayName: z.string().max(160),
  status: syncAttendanceStatusSchema,
});

export type SyncStudentRecord = z.infer<typeof syncStudentRecordSchema>;

export const syncSessionPayloadSchema = z.object({
  meetingId: z.string().max(128),
  meetingTitle: z.string().max(200),
  className: z.string().max(120),
  expiresAt: z.string().max(64),
  students: z.array(syncStudentRecordSchema).max(500),
});

export type SyncSessionPayload = z.infer<typeof syncSessionPayloadSchema>;

export const attendanceSyncExchangeRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(10, "Sync code is invalid")
    .max(128, "Sync code is invalid"),
});

export type AttendanceSyncExchangeRequest = z.infer<
  typeof attendanceSyncExchangeRequestSchema
>;

export const attendanceSyncCodeResponseSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
});

export type AttendanceSyncCodeResponse = z.infer<
  typeof attendanceSyncCodeResponseSchema
>;
