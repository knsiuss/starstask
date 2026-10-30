import { z } from "zod";

import { classIdSchema } from "./classes";

/**
 * Absence-request contracts.
 *
 * There is deliberately no `approved` or `rejected` status here. StarsTask
 * collects absence requests and forwards them; the academic decision happens
 * outside this product, so a status for it would be a lie the database could
 * hold. The class admin has no review decision either — `forwarded` means
 * "included in a completed forwarding package" and nothing more.
 *
 * `draft` is internal: it is a half-filled request the student has not sent
 * yet. The administrative statuses are `submitted`, `forwarded`, and
 * `cancelled`.
 */

export const LEAVE_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "forwarded",
  "cancelled",
] as const;

export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

export const LEAVE_REASON_CATEGORIES = [
  "illness",
  "family_matter",
  "other",
] as const;

export type LeaveReasonCategory = (typeof LEAVE_REASON_CATEGORIES)[number];

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  forwarded: "Forwarded",
  cancelled: "Cancelled",
};

export const LEAVE_REASON_LABELS: Record<LeaveReasonCategory, string> = {
  illness: "Illness",
  family_matter: "Family matter",
  other: "Other",
};

/** Statuses a student may still edit. */
export const EDITABLE_LEAVE_STATUSES = ["draft"] as const;

/** The only status that may be included in a forwarding package. */
export const FORWARDABLE_LEAVE_STATUSES = ["submitted"] as const;

/** A request may be cancelled until it has been forwarded. */
export const CANCELLABLE_LEAVE_STATUSES = ["draft", "submitted"] as const;

export const LEAVE_EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type LeaveEvidenceMimeType = (typeof LEAVE_EVIDENCE_MIME_TYPES)[number];

/** Must stay in sync with `file_size_limit` on the `leave-evidence` bucket. */
export const LEAVE_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const LEAVE_EVIDENCE_MAX_FILES = 10;

export const LEAVE_REPORT_FORMATS = ["summary", "complete"] as const;

export type LeaveReportFormat = (typeof LEAVE_REPORT_FORMATS)[number];

export const LEAVE_EXPLANATION_MIN = 10;
export const LEAVE_EXPLANATION_MAX = 4_000;
export const LEAVE_CANCELLATION_NOTE_MAX = 2_000;
export const LEAVE_MAX_RANGE_DAYS = 365;
export const LEAVE_FORWARDING_MAX_REQUESTS = 200;
export const LEAVE_RECIPIENT_NAME_MAX = 160;

export const leaveRequestIdSchema = z.uuid("Invalid leave request id");
export const leaveEvidenceIdSchema = z.uuid("Invalid evidence id");
export const leaveForwardingIdSchema = z.uuid("Invalid forwarding id");

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rejects `2026-02-30` and friends.
 *
 * A regex alone accepts impossible dates, and those would then reach Postgres
 * as a confusing cast error instead of a field-level message.
 */
function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** A plain calendar date: no time, no zone, no shifting. */
export const isoDateSchema = z
  .string()
  .trim()
  .refine(
    (value) => ISO_DATE_PATTERN.test(value) && isRealCalendarDate(value),
    { message: "Enter a valid date" },
  );

/** A date input that may legitimately be left empty. */
const optionalDateField = z
  .union([z.literal(""), isoDateSchema])
  .nullish()
  .transform((value) => (value ? value : null));

const optionalReasonField = z
  .union([z.literal(""), z.enum(LEAVE_REASON_CATEGORIES)])
  .nullish()
  .transform((value) => (value ? value : null));

const optionalExplanationField = z
  .string()
  .trim()
  .max(LEAVE_EXPLANATION_MAX, "Keep the explanation under 4000 characters")
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalRecipientEmailField = z
  .union([z.literal(""), z.email("Enter a valid email address")])
  .nullish()
  .transform((value) => (value ? value : null));

/**
 * Date-relationship checks shared by create and update.
 *
 * A draft may be half-filled, so a missing side is not an error here; only a
 * pair that is present and contradictory is.
 */
function refineDateRange(
  value: { leaveStartDate: string | null; leaveEndDate: string | null },
  context: z.RefinementCtx,
): void {
  if (!value.leaveStartDate || !value.leaveEndDate) {
    return;
  }

  const start = Date.parse(`${value.leaveStartDate}T00:00:00Z`);
  const end = Date.parse(`${value.leaveEndDate}T00:00:00Z`);

  if (end < start) {
    context.addIssue({
      code: "custom",
      path: ["leaveEndDate"],
      message: "The end date cannot be before the start date",
    });

    return;
  }

  const days = Math.round((end - start) / 86_400_000);

  if (days > LEAVE_MAX_RANGE_DAYS) {
    context.addIssue({
      code: "custom",
      path: ["leaveEndDate"],
      message: `A single request may cover at most ${LEAVE_MAX_RANGE_DAYS} days`,
    });
  }
}

const leaveRequestFieldsSchema = z.object({
  leaveStartDate: optionalDateField,
  leaveEndDate: optionalDateField,
  reasonCategory: optionalReasonField,
  explanation: optionalExplanationField,
  documentIssueDate: optionalDateField,
});

/** Creating a draft: only the class is mandatory. */
export const leaveRequestCreateSchema = z
  .object({ classId: classIdSchema })
  .and(leaveRequestFieldsSchema)
  .superRefine(refineDateRange);

/** Editing a draft or a request returned for revision. */
export const leaveRequestUpdateSchema =
  leaveRequestFieldsSchema.superRefine(refineDateRange);

/** Everything the student must have filled in before submitting. */
export const leaveSubmissionRequirementsSchema = z
  .object({
    leaveStartDate: isoDateSchema,
    leaveEndDate: isoDateSchema,
    reasonCategory: z.enum(LEAVE_REASON_CATEGORIES),
    explanation: z
      .string()
      .trim()
      .min(
        LEAVE_EXPLANATION_MIN,
        "Explain the reason in at least 10 characters",
      )
      .max(LEAVE_EXPLANATION_MAX),
  })
  .superRefine(refineDateRange);

export type LeaveRequestCreateInput = z.infer<typeof leaveRequestCreateSchema>;
export type LeaveRequestUpdateInput = z.infer<typeof leaveRequestUpdateSchema>;

/**
 * Cancelling is administrative, not a decision about the absence. The note is
 * optional and is shown to the other party in the request history.
 */
export const leaveCancellationSchema = z.object({
  note: z
    .string()
    .trim()
    .max(
      LEAVE_CANCELLATION_NOTE_MAX,
      `Keep the note under ${LEAVE_CANCELLATION_NOTE_MAX} characters`,
    )
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type LeaveCancellationInput = z.infer<typeof leaveCancellationSchema>;

/**
 * Evidence metadata registered after the object is stored.
 *
 * The server re-validates the bytes and derives the MIME type itself; this
 * schema only guards the shape of what the route receives.
 */
export const leaveEvidenceRegisterSchema = z.object({
  requestId: leaveRequestIdSchema,
  storagePath: z.string().trim().min(10).max(500),
  originalFilename: z.string().trim().min(1).max(200),
  mimeType: z.enum(LEAVE_EVIDENCE_MIME_TYPES),
  fileSize: z.number().int().min(1).max(LEAVE_EVIDENCE_MAX_BYTES),
});

/** Fields an OCR provider may suggest. All optional: OCR finds what it finds. */
export const leaveOcrSuggestionSchema = z.object({
  documentIssueDate: isoDateSchema.nullish(),
  leaveStartDate: isoDateSchema.nullish(),
  leaveEndDate: isoDateSchema.nullish(),
  studentName: z.string().trim().max(120).nullish(),
  documentType: z.string().trim().max(80).nullish(),
  confidence: z.number().min(0).max(1).nullish(),
});

export type LeaveOcrSuggestion = z.infer<typeof leaveOcrSuggestionSchema>;

export const LEAVE_OCR_STATUSES = [
  "not_run",
  "pending",
  "succeeded",
  "failed",
  "unsupported",
] as const;

export type LeaveOcrStatus = (typeof LEAVE_OCR_STATUSES)[number];

/** Where a stored value came from, so a reviewer can tell guess from fact. */
export const LEAVE_FIELD_SOURCES = ["manual", "ocr", "ocr_corrected"] as const;

export type LeaveFieldSource = (typeof LEAVE_FIELD_SOURCES)[number];

export const LEAVE_CONFIRMABLE_FIELDS = [
  "documentIssueDate",
  "leaveStartDate",
  "leaveEndDate",
  "studentName",
  "documentType",
] as const;

export const leaveFieldSourcesSchema = z.record(
  z.enum(LEAVE_CONFIRMABLE_FIELDS),
  z.enum(LEAVE_FIELD_SOURCES),
);

export const leaveOcrConfirmSchema = z.object({
  fieldSources: leaveFieldSourcesSchema,
});

/**
 * One forwarding operation.
 *
 * `idempotencyKey` makes a retried submit return the original record instead of
 * producing a second package.
 */
const leaveForwardingBaseSchema = z.object({
  classId: classIdSchema,
  requestIds: z
    .array(leaveRequestIdSchema)
    .min(1, "Select at least one request")
    .max(
      LEAVE_FORWARDING_MAX_REQUESTS,
      `At most ${LEAVE_FORWARDING_MAX_REQUESTS} requests per package`,
    ),
  recipientName: z
    .string()
    .trim()
    .min(1, "Enter the lecturer's name")
    .max(LEAVE_RECIPIENT_NAME_MAX),
  recipientEmail: optionalRecipientEmailField,
  reportFormat: z.enum(LEAVE_REPORT_FORMATS),
  idempotencyKey: z.string().trim().min(8).max(200),
});

function refineDistinctRequests(
  value: { requestIds: string[] },
  context: z.RefinementCtx,
): void {
  if (new Set(value.requestIds).size !== value.requestIds.length) {
    context.addIssue({
      code: "custom",
      path: ["requestIds"],
      message: "The selection contains duplicates",
    });
  }
}

/** Server-side shape, including the class the package belongs to. */
export const leaveForwardingSchema = leaveForwardingBaseSchema.superRefine(
  refineDistinctRequests,
);

/**
 * Route shape: the class comes from the URL slug, so the body never supplies it
 * and a caller cannot point the request at a class they do not administer.
 */
export const leaveForwardingRequestSchema = leaveForwardingBaseSchema
  .omit({ classId: true })
  .superRefine(refineDistinctRequests);

export type LeaveForwardingRequestInput = z.infer<
  typeof leaveForwardingRequestSchema
>;

export const leaveRequestListQuerySchema = z.object({
  class: z.string().trim().min(3).max(80).optional(),
  status: z.enum(["all", ...LEAVE_REQUEST_STATUSES]).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type LeaveRequestListQuery = z.infer<typeof leaveRequestListQuerySchema>;

export function isLeaveRequestEditable(status: LeaveRequestStatus): boolean {
  return status === "draft";
}

export function isLeaveRequestForwardable(status: LeaveRequestStatus): boolean {
  return status === "submitted";
}

export function isLeaveRequestCancellable(status: LeaveRequestStatus): boolean {
  return status === "draft" || status === "submitted";
}
