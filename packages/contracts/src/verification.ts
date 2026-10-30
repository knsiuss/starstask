import { z } from "zod";

import { classIdSchema } from "./classes";

/**
 * Class representative verification contracts.
 *
 * A declared position is a claim, never a permission. Only a platform admin
 * decision moves a request to `verified`, and only that decision may create a
 * class-scoped class admin assignment.
 */

export const DECLARED_POSITIONS = ["student", "class_representative"] as const;

export type DeclaredPosition = (typeof DECLARED_POSITIONS)[number];

export const DECLARED_POSITION_LABELS: Record<DeclaredPosition, string> = {
  student: "Student",
  class_representative: "Class Representative / Ketua Kelas",
};

/** `not_requested` is represented by the absence of a submitted request. */
export const VERIFICATION_STATUSES = [
  "pending",
  "needs_revision",
  "verified",
  "rejected",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: "Pending review",
  needs_revision: "Revision requested",
  verified: "Verified",
  rejected: "Rejected",
};

export const VERIFICATION_DECISIONS = [
  "approve",
  "reject",
  "request_revision",
] as const;

export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

/** The only status each decision can produce on the server. */
export const VERIFICATION_DECISION_STATUS: Record<
  VerificationDecision,
  VerificationStatus
> = {
  approve: "verified",
  reject: "rejected",
  request_revision: "needs_revision",
};

export const VERIFICATION_EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type VerificationEvidenceMimeType =
  (typeof VERIFICATION_EVIDENCE_MIME_TYPES)[number];

/** Must stay in sync with the `verification-evidence` bucket limit. */
export const VERIFICATION_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const VERIFICATION_EVIDENCE_MAX_FILES = 5;

export const VERIFICATION_EVIDENCE_ALLOWED_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
] as const;

export const VERIFICATION_STATEMENT_MIN = 10;
export const VERIFICATION_STATEMENT_MAX = 2_000;
export const VERIFICATION_NOTE_MIN = 3;
export const VERIFICATION_NOTE_MAX = 2_000;
export const VERIFICATION_SEARCH_MAX = 100;

export const VERIFICATION_QUEUE_STATUSES = [
  ...VERIFICATION_STATUSES,
  "all",
] as const;

export type VerificationQueueStatus =
  (typeof VERIFICATION_QUEUE_STATUSES)[number];

export const verificationRequestIdSchema = z.uuid("Invalid verification id");
export const verificationEvidenceIdSchema = z.uuid("Invalid evidence id");

const optionalStatementField = z
  .string()
  .trim()
  .max(
    VERIFICATION_STATEMENT_MAX,
    `Keep the explanation under ${VERIFICATION_STATEMENT_MAX} characters`,
  )
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine(
    (value) => value === null || value.length >= VERIFICATION_STATEMENT_MIN,
    {
      message: `Explain in at least ${VERIFICATION_STATEMENT_MIN} characters, or leave it empty`,
    },
  );

const optionalNoteField = z
  .string()
  .trim()
  .max(
    VERIFICATION_NOTE_MAX,
    `Keep the note under ${VERIFICATION_NOTE_MAX} characters`,
  )
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

export const declaredPositionUpdateSchema = z
  .object({ position: z.enum(DECLARED_POSITIONS) })
  .strict();

export type DeclaredPositionUpdateInput = z.infer<
  typeof declaredPositionUpdateSchema
>;

export const verificationRequestCreateSchema = z
  .object({
    classId: classIdSchema,
    statement: optionalStatementField,
  })
  .strict();

export type VerificationRequestCreateInput = z.infer<
  typeof verificationRequestCreateSchema
>;

/**
 * Temporary direct grant (owner decision, 2026-10-29): while review is
 * disabled, a class member claims representative access for their class.
 */
export const representativeGrantSchema = z
  .object({ classId: classIdSchema })
  .strict();

export type RepresentativeGrantInput = z.infer<
  typeof representativeGrantSchema
>;

export const verificationRequestReviseSchema = z
  .object({ statement: optionalStatementField })
  .strict();

export type VerificationRequestReviseInput = z.infer<
  typeof verificationRequestReviseSchema
>;

/**
 * A decision must name its outcome explicitly. Rejection and revision both
 * require a note the student can act on; approval requires a separate
 * confirmation because it grants class admin access.
 */
export const verificationDecisionSchema = z
  .object({
    decision: z.enum(VERIFICATION_DECISIONS),
    note: optionalNoteField,
    confirmGrant: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.decision !== "approve" &&
      (value.note === null || value.note.length < VERIFICATION_NOTE_MIN)
    ) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Explain the decision in at least 3 characters",
      });
    }

    if (
      value.note !== null &&
      value.note.length > 0 &&
      value.note.length < VERIFICATION_NOTE_MIN
    ) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "The note must be at least 3 characters",
      });
    }

    if (value.decision === "approve" && !value.confirmGrant) {
      context.addIssue({
        code: "custom",
        path: ["confirmGrant"],
        message: "Confirm that this grants class admin access",
      });
    }
  });

export type VerificationDecisionInput = z.infer<
  typeof verificationDecisionSchema
>;

export const verificationRevokeSchema = z
  .object({
    note: z
      .string()
      .trim()
      .min(VERIFICATION_NOTE_MIN, "Explain why access is being revoked")
      .max(VERIFICATION_NOTE_MAX),
    confirmRevoke: z.boolean().refine((value) => value, {
      message: "Confirm that access should be removed",
    }),
  })
  .strict();

export type VerificationRevokeInput = z.infer<typeof verificationRevokeSchema>;

export const verificationQueueQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(VERIFICATION_SEARCH_MAX)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  status: z.enum(VERIFICATION_QUEUE_STATUSES).default("pending"),
  class: z
    .uuid("Invalid class id")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  semester: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type VerificationQueueQuery = z.infer<
  typeof verificationQueueQuerySchema
>;
