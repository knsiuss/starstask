import { z } from "zod";

/**
 * Trust-loop contracts: a reader reports a problem, a reviewer closes it.
 *
 * The database functions are the authority on who may report or review; these
 * schemas only reject malformed payloads before they reach the database.
 */

export const ASSIGNMENT_REPORT_REASONS = [
  "wrong_deadline",
  "wrong_details",
  "duplicate",
  "broken_attachment",
  "other",
] as const;

export type AssignmentReportReason = (typeof ASSIGNMENT_REPORT_REASONS)[number];

export const ASSIGNMENT_REPORT_REASON_LABELS: Record<
  AssignmentReportReason,
  string
> = {
  wrong_deadline: "Deadline is wrong",
  wrong_details: "Details are wrong",
  duplicate: "Duplicate of another assignment",
  broken_attachment: "Attachment does not open",
  other: "Something else",
};

export const ASSIGNMENT_REPORT_STATUSES = [
  "open",
  "resolved",
  "dismissed",
] as const;

export type AssignmentReportStatus =
  (typeof ASSIGNMENT_REPORT_STATUSES)[number];

export const ASSIGNMENT_REPORT_STATUS_LABELS: Record<
  AssignmentReportStatus,
  string
> = {
  open: "Open",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

/** Reviewers may only move an open report to one of these states. */
export const ASSIGNMENT_REPORT_REVIEW_STATUSES = [
  "resolved",
  "dismissed",
] as const;

export type AssignmentReportReviewStatus =
  (typeof ASSIGNMENT_REPORT_REVIEW_STATUSES)[number];

export const ASSIGNMENT_REPORT_NOTE_MIN = 5;
export const ASSIGNMENT_REPORT_NOTE_MAX = 2_000;

const optionalNote = z
  .string()
  .trim()
  .max(ASSIGNMENT_REPORT_NOTE_MAX)
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .refine(
    (value) =>
      value === undefined || value.length >= ASSIGNMENT_REPORT_NOTE_MIN,
    { message: "Add a little more detail (at least 5 characters)." },
  );

export const assignmentReportCreateSchema = z.object({
  reason: z.enum(ASSIGNMENT_REPORT_REASONS),
  note: optionalNote,
});

export type AssignmentReportCreateInput = z.infer<
  typeof assignmentReportCreateSchema
>;

export const assignmentReportReviewSchema = z.object({
  status: z.enum(ASSIGNMENT_REPORT_REVIEW_STATUSES),
  note: optionalNote,
});

export type AssignmentReportReviewInput = z.infer<
  typeof assignmentReportReviewSchema
>;

export const assignmentReportIdSchema = z.uuid("Invalid report id");
export const assignmentRevisionIdSchema = z.uuid("Invalid revision id");
