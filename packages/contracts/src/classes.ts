import { z } from "zod";

import {
  ASSIGNMENT_TAGS_MAX,
  ASSIGNMENT_TAG_MAX,
  ASSIGNMENT_TITLE_MAX,
  ASSIGNMENT_TYPES,
  isoDateTimeWithOffsetSchema,
  normalizeTags,
  referenceUrlListSchema,
} from "./assignment";

export const CLASS_APPLICATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
] as const;

export type ClassApplicationStatus =
  (typeof CLASS_APPLICATION_STATUSES)[number];

export const CLASS_STATUSES = ["active", "archived"] as const;

export type ClassStatus = (typeof CLASS_STATUSES)[number];

export const ASSIGNMENT_REVIEW_DECISIONS = ["approved", "rejected"] as const;

export type AssignmentReviewDecision =
  (typeof ASSIGNMENT_REVIEW_DECISIONS)[number];

export const MODERATION_ACTIONS = ["unpublish", "archive", "restore"] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

/** Assignment states a class member may still edit and resubmit. */
export const EDITABLE_SUBMISSION_STATUSES = ["draft", "rejected"] as const;

export const CLASS_SLUG_MIN = 3;
export const CLASS_SLUG_MAX = 80;
export const CLASS_NAME_MIN = 3;
export const CLASS_NAME_MAX = 120;
export const CLASS_DESCRIPTION_MIN = 10;
export const CLASS_DESCRIPTION_MAX = 5_000;
export const CLASS_COURSE_NAME_MIN = 2;
export const CLASS_COURSE_NAME_MAX = 120;
export const CLASS_SEMESTER_MAX = 20;
export const CLASS_ACADEMIC_YEAR_PATTERN = /^\d{4}\/\d{4}$/;
export const CLASS_REASON_MIN = 10;
export const CLASS_REASON_MAX = 2_000;
export const CLASS_SUPPORTING_INFO_MAX = 2_000;
export const CLASS_DECISION_NOTE_MIN = 3;
export const CLASS_DECISION_NOTE_MAX = 2_000;
export const CLASS_REJECTION_REASON_MIN = 3;
export const CLASS_REJECTION_REASON_MAX = 2_000;
export const INVITATION_MAX_USES_MAX = 500;
export const INVITATION_MAX_LIFETIME_DAYS = 90;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

/**
 * Slugs are lowercase, hyphen separated, and URL safe. The same pattern is
 * enforced by a database constraint, so the API and the schema cannot drift.
 */
export const classSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(CLASS_SLUG_MIN, "Slug must be at least 3 characters")
  .max(CLASS_SLUG_MAX, "Slug must be 80 characters or fewer")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens",
  );

export const classIdSchema = z.uuid("Invalid class id");

export const classApplicationIdSchema = z.uuid("Invalid application id");

export const invitationIdSchema = z.uuid("Invalid invitation id");

export const memberUserIdSchema = z.uuid("Invalid user id");

export const attachmentIdSchema = z.uuid("Invalid attachment id");

const academicYearSchema = z
  .string()
  .trim()
  .regex(CLASS_ACADEMIC_YEAR_PATTERN, "Use the format 2025/2026");

const classApplicationFields = {
  proposedSlug: classSlugSchema,
  proposedName: z
    .string()
    .trim()
    .min(CLASS_NAME_MIN, "Class name must be at least 3 characters")
    .max(CLASS_NAME_MAX, "Class name must be 120 characters or fewer"),
  courseName: z
    .string()
    .trim()
    .min(CLASS_COURSE_NAME_MIN, "Course name is required")
    .max(CLASS_COURSE_NAME_MAX, "Course name must be 120 characters or fewer"),
  institution: optionalText(CLASS_NAME_MAX),
  lecturerName: optionalText(CLASS_NAME_MAX),
  semester: z
    .string()
    .trim()
    .min(1, "Semester is required")
    .max(CLASS_SEMESTER_MAX, "Semester must be 20 characters or fewer"),
  academicYear: academicYearSchema,
  description: z
    .string()
    .trim()
    .min(CLASS_DESCRIPTION_MIN, "Description must be at least 10 characters")
    .max(
      CLASS_DESCRIPTION_MAX,
      "Description must be 5,000 characters or fewer",
    ),
  reason: z
    .string()
    .trim()
    .min(CLASS_REASON_MIN, "Explain why the class is needed")
    .max(CLASS_REASON_MAX, "Reason must be 2,000 characters or fewer"),
  supportingInfo: optionalText(CLASS_SUPPORTING_INFO_MAX),
};

export const classApplicationCreateSchema = z.object(classApplicationFields);

export type ClassApplicationCreateInput = z.infer<
  typeof classApplicationCreateSchema
>;

/**
 * Revising a rejected application re-validates every field, because the
 * applicant may have changed any of them.
 */
export const classApplicationReviseSchema = classApplicationCreateSchema;

export type ClassApplicationReviseInput = z.infer<
  typeof classApplicationReviseSchema
>;

export const classApplicationDecisionSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    note: optionalText(CLASS_DECISION_NOTE_MAX),
    grantClassAdmin: z.boolean().default(false),
  })
  .strict()
  .refine(
    (value) =>
      value.decision !== "rejected" ||
      (value.note !== undefined &&
        value.note.length >= CLASS_DECISION_NOTE_MIN),
    {
      message: "A rejection reason of at least 3 characters is required",
      path: ["note"],
    },
  );

export type ClassApplicationDecisionInput = z.infer<
  typeof classApplicationDecisionSchema
>;

export const classMetadataUpdateSchema = z
  .object({
    name: classApplicationFields.proposedName,
    description: classApplicationFields.description,
    courseName: classApplicationFields.courseName,
    institution: optionalText(CLASS_NAME_MAX),
    lecturerName: optionalText(CLASS_NAME_MAX),
    semester: classApplicationFields.semester,
    academicYear: academicYearSchema,
  })
  .strict();

export type ClassMetadataUpdateInput = z.infer<
  typeof classMetadataUpdateSchema
>;

export const classStatusUpdateSchema = z
  .object({ status: z.enum(CLASS_STATUSES) })
  .strict();

export type ClassStatusUpdateInput = z.infer<typeof classStatusUpdateSchema>;

export const classAdminAssignSchema = z
  .object({ userId: memberUserIdSchema })
  .strict();

export type ClassAdminAssignInput = z.infer<typeof classAdminAssignSchema>;

/**
 * Invitation links are generated server-side; the client only chooses the
 * lifetime, the number of uses, and an optional email restriction.
 */
export const classInvitationCreateSchema = z
  .object({
    expiresInDays: z.coerce
      .number()
      .int()
      .min(1, "Expiry must be at least 1 day")
      .max(
        INVITATION_MAX_LIFETIME_DAYS,
        `Expiry cannot exceed ${INVITATION_MAX_LIFETIME_DAYS} days`,
      )
      .default(7),
    maxUses: z.coerce
      .number()
      .int()
      .min(1, "Use at least one slot")
      .max(INVITATION_MAX_USES_MAX, "Use 500 slots or fewer")
      .default(1),
    email: optionalText(254).refine(
      (value) =>
        value === undefined || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
      { message: "Enter a valid email address" },
    ),
  })
  .strict();

export type ClassInvitationCreateInput = z.infer<
  typeof classInvitationCreateSchema
>;

export const classInvitationAcceptSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(20, "Invalid invitation token")
      .max(200, "Invalid invitation token"),
  })
  .strict();

export type ClassInvitationAcceptInput = z.infer<
  typeof classInvitationAcceptSchema
>;

const submissionFields = {
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(ASSIGNMENT_TITLE_MAX, "Title must be 200 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(20_000, "Description must be 20,000 characters or fewer"),
  deadline: isoDateTimeWithOffsetSchema.optional(),
  assignmentType: z.enum(ASSIGNMENT_TYPES).optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tags cannot be empty")
        .max(ASSIGNMENT_TAG_MAX, "Each tag must be 32 characters or fewer"),
    )
    .max(ASSIGNMENT_TAGS_MAX, "Use at most 10 tags")
    .optional()
    .transform((tags) => normalizeTags(tags ?? [])),
  referenceUrls: referenceUrlListSchema
    .optional()
    .transform((urls) => urls ?? []),
};

export const classSubmissionCreateSchema = z.object(submissionFields);

export type ClassSubmissionCreateInput = z.infer<
  typeof classSubmissionCreateSchema
>;

export const classSubmissionReviseSchema = classSubmissionCreateSchema;

export type ClassSubmissionReviseInput = z.infer<
  typeof classSubmissionReviseSchema
>;

/**
 * `confirmPublic` is required for approval: the reviewer must acknowledge that
 * the submission and its attachments become publicly visible.
 */
export const assignmentReviewSchema = z
  .object({
    decision: z.enum(ASSIGNMENT_REVIEW_DECISIONS),
    reason: optionalText(CLASS_REJECTION_REASON_MAX),
    confirmPublic: z.boolean().default(false),
  })
  .strict()
  .refine(
    (value) =>
      value.decision !== "rejected" ||
      (value.reason !== undefined &&
        value.reason.length >= CLASS_REJECTION_REASON_MIN),
    {
      message: "A rejection reason of at least 3 characters is required",
      path: ["reason"],
    },
  )
  .refine((value) => value.decision !== "approved" || value.confirmPublic, {
    message: "Confirm that the submission and its attachments may be published",
    path: ["confirmPublic"],
  });

export type AssignmentReviewInput = z.infer<typeof assignmentReviewSchema>;

export const assignmentModerationSchema = z
  .object({
    action: z.enum(MODERATION_ACTIONS),
    reason: optionalText(CLASS_REJECTION_REASON_MAX),
  })
  .strict()
  .refine(
    (value) =>
      value.action === "restore" ||
      (value.reason !== undefined &&
        value.reason.length >= CLASS_REJECTION_REASON_MIN),
    {
      message: "A moderation reason of at least 3 characters is required",
      path: ["reason"],
    },
  );

export type AssignmentModerationInput = z.infer<
  typeof assignmentModerationSchema
>;

export const attachmentRemovalSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(
        CLASS_REJECTION_REASON_MIN,
        "A removal reason of at least 3 characters is required",
      )
      .max(CLASS_REJECTION_REASON_MAX),
  })
  .strict();

export type AttachmentRemovalInput = z.infer<typeof attachmentRemovalSchema>;

export const classDiscoveryQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100, "Search must be 100 characters or fewer")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  semester: z
    .string()
    .trim()
    .max(CLASS_SEMESTER_MAX)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
});

export type ClassDiscoveryQuery = z.infer<typeof classDiscoveryQuerySchema>;

export const reviewQueueQuerySchema = z.object({
  status: z
    .enum([
      "pending_review",
      "rejected",
      "published",
      "unpublished",
      "archived",
    ])
    .default("pending_review"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema>;

export const classAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export type ClassAuditQuery = z.infer<typeof classAuditQuerySchema>;
