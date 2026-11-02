import { z } from "zod";

import {
  ASSIGNMENT_CONTENT_TYPES,
  ASSIGNMENT_TAGS_MAX,
  ASSIGNMENT_TAG_MAX,
  ASSIGNMENT_TITLE_MAX,
  ASSIGNMENT_TYPES,
  SOURCE_LABEL_MAX,
  isoDateTimeWithOffsetSchema,
  normalizeTags,
  optionalGoogleDriveUrlSchema,
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

/** Lifecycle of a class. Draft classes are invisible to students. */
export const CLASS_LIFECYCLE_STATUSES = [
  "draft",
  "active",
  "archived",
] as const;

export type ClassLifecycleStatus = (typeof CLASS_LIFECYCLE_STATUSES)[number];

/**
 * Statuses a class subject may hold. Subjects do not have a draft life of their
 * own, so they deliberately reuse only active and archived.
 */
export const CLASS_STATUSES = ["active", "archived"] as const;

export type ClassStatus = (typeof CLASS_STATUSES)[number];

/**
 * `invitation` only admits members through an invitation link. `open` also
 * lets a matching typed class name join automatically.
 */
export const CLASS_JOIN_POLICIES = ["invitation", "open"] as const;

export type ClassJoinPolicy = (typeof CLASS_JOIN_POLICIES)[number];

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

export const CLASS_CODE_MIN = 2;
export const CLASS_CODE_MAX = 20;

const CLASS_CODE_PATTERN = /^[A-Z0-9][A-Z0-9 ._/-]*$/;

/**
 * A class code is the human-readable identifier lecturers quote, such as
 * `TPL-M002`. It is normalized to uppercase so casing and surrounding
 * whitespace cannot create a duplicate inside one academic period. The UUID
 * remains the only real identity.
 */
export const classCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(CLASS_CODE_MIN, "Class code must be at least 2 characters")
  .max(CLASS_CODE_MAX, "Class code must be 20 characters or fewer")
  .regex(CLASS_CODE_PATTERN, "Use letters, numbers, spaces, or . _ / - only");

const optionalClassCode = z
  .string()
  .trim()
  .max(CLASS_CODE_MAX, "Class code must be 20 characters or fewer")
  .optional()
  .transform((value) =>
    value === undefined || value === "" ? undefined : value.toUpperCase(),
  )
  .refine(
    (value) =>
      value === undefined ||
      (value.length >= CLASS_CODE_MIN && CLASS_CODE_PATTERN.test(value)),
    { message: "Use 2-20 letters, numbers, spaces, or . _ / -" },
  );

const classApplicationFields = {
  proposedSlug: classSlugSchema,
  proposedName: z
    .string()
    .trim()
    .min(CLASS_NAME_MIN, "Class name must be at least 3 characters")
    .max(CLASS_NAME_MAX, "Class name must be 120 characters or fewer"),
  proposedClassCode: optionalClassCode,
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
    /** Approval can start the class hidden from students. */
    initialStatus: z.enum(["draft", "active"]).default("active"),
    /**
     * Required when a class with the same code or name already exists in the
     * same academic period. The API re-checks the duplicates itself.
     */
    confirmDuplicate: z.boolean().default(false),
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
    classCode: optionalClassCode,
    joinPolicy: z.enum(CLASS_JOIN_POLICIES).optional(),
  })
  .strict();

export type ClassMetadataUpdateInput = z.infer<
  typeof classMetadataUpdateSchema
>;

export const classStatusUpdateSchema = z
  .object({ status: z.enum(CLASS_LIFECYCLE_STATUSES) })
  .strict();

export type ClassStatusUpdateInput = z.infer<typeof classStatusUpdateSchema>;

/**
 * Deleting a class needs the caller to retype its class code, or its name when
 * no code is set. The API compares it with the stored values, so a stray
 * request cannot delete the wrong class.
 */
export const classDeleteSchema = z
  .object({
    confirm: z
      .string()
      .trim()
      .min(1, "Type the class code or name to confirm")
      .max(CLASS_NAME_MAX),
  })
  .strict();

export type ClassDeleteInput = z.infer<typeof classDeleteSchema>;

/**
 * Preliminary duplicate lookup. It only warns: the platform admin still makes
 * an explicit decision, and nothing is ever merged automatically.
 */
export const classDuplicateCheckSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Class name is required")
      .max(CLASS_NAME_MAX),
    classCode: optionalClassCode,
    academicYear: academicYearSchema,
    semester: z
      .string()
      .trim()
      .min(1, "Semester is required")
      .max(CLASS_SEMESTER_MAX),
    institution: optionalText(CLASS_NAME_MAX),
    excludeClassId: classIdSchema.optional(),
  })
  .strict();

export type ClassDuplicateCheckInput = z.infer<
  typeof classDuplicateCheckSchema
>;

export type ClassDuplicateMatch = {
  classId: string;
  slug: string;
  name: string;
  classCode: string | null;
  academicYear: string;
  semester: string;
  institution: string | null;
  status: ClassLifecycleStatus;
  codeMatch: boolean;
  nameMatch: boolean;
};

/** Counts shown before a class may be archived or permanently deleted. */
export type ClassDependencySummary = {
  classStatus: ClassLifecycleStatus;
  memberCount: number;
  assignmentCount: number;
  submissionCount: number;
  sessionCount: number;
  attendanceCount: number;
  scheduleCount: number;
  calendarEventCount: number;
  leaveRequestCount: number;
  subjectCount: number;
  invitationCount: number;
  hasHistory: boolean;
  canDelete: boolean;
};

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
  contentType: z.enum(ASSIGNMENT_CONTENT_TYPES).default("lecturer_assignment"),
  /** Names the lecturer behind the instructions; never the recording admin. */
  sourceLabel: z
    .string()
    .trim()
    .max(SOURCE_LABEL_MAX, "Use 120 characters or fewer")
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  driveUrl: optionalGoogleDriveUrlSchema,
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

/**
 * Academic content always belongs to a course. The course is required so a
 * post can never silently fall back to the class group as its subject.
 */
export const classSubmissionCreateSchema = z.object({
  ...submissionFields,
  subjectId: z.uuid("Choose a course"),
});

export type ClassSubmissionCreateInput = z.infer<
  typeof classSubmissionCreateSchema
>;

/**
 * Revision keeps the course chosen when the submission was created. It is
 * optional here because the revision form does not read it, and the database
 * function leaves `subject_id` untouched.
 */
export const classSubmissionReviseSchema = z.object({
  ...submissionFields,
  subjectId: z.uuid("Invalid course id").optional(),
});

export type ClassSubmissionReviseInput = z.infer<
  typeof classSubmissionReviseSchema
>;

export const courseMaterialIdSchema = z.uuid("Invalid material id");

export const COURSE_MATERIAL_KINDS = [
  "document",
  "video",
  "link",
  "other",
] as const;

export type CourseMaterialKind = (typeof COURSE_MATERIAL_KINDS)[number];

export const COURSE_MATERIAL_TITLE_MIN = 3;
export const COURSE_MATERIAL_TITLE_MAX = 200;
export const COURSE_MATERIAL_DESCRIPTION_MAX = 5_000;
export const COURSE_MATERIAL_URL_MAX = 2_048;

const optionalCourseMaterialText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) =>
      value === "" || value === undefined ? undefined : value,
    );

const courseMaterialUrlSchema = z
  .string()
  .trim()
  .max(COURSE_MATERIAL_URL_MAX, "Use 2,048 characters or fewer")
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .refine((value) => value === undefined || /^https:\/\/\S+$/.test(value), {
    message: "Use a full https:// link",
  });

const courseMaterialFields = {
  subjectId: z.uuid("Choose a course"),
  kind: z.enum(COURSE_MATERIAL_KINDS).default("document"),
  title: z
    .string()
    .trim()
    .min(COURSE_MATERIAL_TITLE_MIN, "Title must be at least 3 characters")
    .max(COURSE_MATERIAL_TITLE_MAX, "Title must be 200 characters or fewer"),
  description: optionalCourseMaterialText(COURSE_MATERIAL_DESCRIPTION_MAX),
  resourceUrl: courseMaterialUrlSchema,
};

/**
 * A material needs either written content or a link. A bare title would create
 * an empty item that students cannot use.
 */
export const courseMaterialCreateSchema = z
  .object(courseMaterialFields)
  .strict()
  .refine((value) => Boolean(value.description) || Boolean(value.resourceUrl), {
    message: "Add a description or a resource link",
    path: ["description"],
  });

export type CourseMaterialCreateInput = z.infer<
  typeof courseMaterialCreateSchema
>;

export const courseMaterialUpdateSchema = z
  .object(courseMaterialFields)
  .strict()
  .refine((value) => Boolean(value.description) || Boolean(value.resourceUrl), {
    message: "Add a description or a resource link",
    path: ["description"],
  });

export type CourseMaterialUpdateInput = z.infer<
  typeof courseMaterialUpdateSchema
>;

export type CourseMaterialView = {
  id: string;
  class_id: string;
  subject_id: string;
  kind: CourseMaterialKind;
  title: string;
  description: string | null;
  resource_url: string | null;
  created_at: string;
  updated_at: string;
};

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

/** Ordering options for the member's own class directory. */
export const CLASS_DIRECTORY_SORTS = ["newest", "alphabetical"] as const;

export type ClassDirectorySort = (typeof CLASS_DIRECTORY_SORTS)[number];

export const CLASS_DIRECTORY_VIEWS = ["grid", "list"] as const;

export type ClassDirectoryView = (typeof CLASS_DIRECTORY_VIEWS)[number];

/**
 * The directory opens on active classes. Drafts belong to their managers and
 * are listed with the active ones; archived classes are reachable through the
 * archive filter instead of disappearing.
 */
export const CLASS_DIRECTORY_STATUSES = ["active", "archived"] as const;

export type ClassDirectoryStatus = (typeof CLASS_DIRECTORY_STATUSES)[number];

/**
 * Filters for "My classes". The directory only ever contains the caller's own
 * memberships, so these narrow a list the reader is already allowed to see.
 */
export const classDirectoryQuerySchema = z.object({
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
  academicYear: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .refine(
      (value) => value === undefined || CLASS_ACADEMIC_YEAR_PATTERN.test(value),
      { message: "Use the format 2025/2026" },
    ),
  status: z.enum(CLASS_DIRECTORY_STATUSES).default("active"),
  sort: z.enum(CLASS_DIRECTORY_SORTS).default("newest"),
  view: z.enum(CLASS_DIRECTORY_VIEWS).default("grid"),
});

export type ClassDirectoryQuery = z.infer<typeof classDirectoryQuerySchema>;

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

export const subjectIdSchema = z.string().uuid("Invalid subject id");

export const classSubjectCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Subject name must be at least 2 characters")
      .max(120, "Subject name must be 120 characters or fewer"),
    code: optionalText(20),
    description: optionalText(2000),
    lecturerName: optionalText(120),
  })
  .strict();

export type ClassSubjectCreateInput = z.infer<typeof classSubjectCreateSchema>;

export const classSubjectUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Subject name must be at least 2 characters")
      .max(120, "Subject name must be 120 characters or fewer")
      .optional(),
    code: optionalText(20),
    description: optionalText(2000),
    lecturerName: optionalText(120),
    status: z.enum(CLASS_STATUSES).optional(),
  })
  .strict();

export type ClassSubjectUpdateInput = z.infer<typeof classSubjectUpdateSchema>;

export type ClassSubjectView = {
  id: string;
  class_id: string;
  course_id: string | null;
  name: string;
  code: string | null;
  description: string | null;
  lecturer_name: string | null;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
};

export type ClassSubjectWithTaskCount = ClassSubjectView & {
  task_count: number;
};

export const classMembersQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ClassMembersQuery = z.infer<typeof classMembersQuerySchema>;

export const classInvitationDeclineSchema = z
  .object({
    invitationId: invitationIdSchema,
  })
  .strict();

export type ClassInvitationDeclineInput = z.infer<
  typeof classInvitationDeclineSchema
>;
