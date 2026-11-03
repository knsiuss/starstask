import { z } from "zod";

import {
  CLASS_APPLICATION_STATUSES,
  CLASS_LIFECYCLE_STATUSES,
} from "./classes";

/**
 * Query contracts for the platform admin console.
 *
 * Every filter is parsed on the server before it reaches PostgREST or an RPC,
 * and page sizes are capped so a hand-written URL cannot request the whole
 * table. These schemas describe reads only; no role or ownership value is ever
 * accepted from the browser.
 */

export const ADMIN_SEARCH_MAX = 100;

const optionalSearch = z
  .string()
  .trim()
  .max(ADMIN_SEARCH_MAX)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const pageField = z.coerce.number().int().min(1).max(500).default(1);
const pageSizeField = z.coerce.number().int().min(1).max(50).default(20);

const optionalReviewReason = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

export const ADMIN_USER_ROLES = ["all", "platform_admin"] as const;
export type AdminUserRole = (typeof ADMIN_USER_ROLES)[number];

export const ADMIN_ONBOARDING_STATES = ["all", "complete", "pending"] as const;
export type AdminOnboardingState = (typeof ADMIN_ONBOARDING_STATES)[number];

export const adminUsersQuerySchema = z.object({
  search: optionalSearch,
  role: z.enum(ADMIN_USER_ROLES).default("all"),
  onboarding: z.enum(ADMIN_ONBOARDING_STATES).default("all"),
  page: pageField,
  pageSize: pageSizeField,
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

/**
 * Statuses an admin assignment row can hold. `pending` is the review state for
 * class-less requests from the public submit form.
 */
export const ADMIN_ASSIGNMENT_STATUSES = [
  "draft",
  "pending_review",
  "pending",
  "published",
  "rejected",
  "unpublished",
  "archived",
] as const;

export type AdminAssignmentStatus = (typeof ADMIN_ASSIGNMENT_STATUSES)[number];

export const ADMIN_ASSIGNMENT_STATUS_LABELS: Record<
  AdminAssignmentStatus,
  string
> = {
  draft: "Draft",
  pending_review: "Pending review",
  pending: "Pending approval",
  published: "Published",
  rejected: "Rejected",
  unpublished: "Unpublished",
  archived: "Archived",
};

const optionalSemester = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const optionalAcademicYear = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .refine((value) => value === undefined || /^\d{4}\/\d{4}$/.test(value), {
    message: "Use the format 2025/2026",
  });

export const adminClassesQuerySchema = z.object({
  search: optionalSearch,
  status: z.enum(["all", ...CLASS_LIFECYCLE_STATUSES]).default("all"),
  academicYear: optionalAcademicYear,
  semester: optionalSemester,
  page: pageField,
  pageSize: pageSizeField,
});

export type AdminClassesQuery = z.infer<typeof adminClassesQuerySchema>;

export const adminAssignmentQuerySchema = z.object({
  search: optionalSearch,
  status: z.enum(["all", ...ADMIN_ASSIGNMENT_STATUSES]).default("all"),
  class: z
    .uuid("Invalid class id")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  page: pageField,
  pageSize: pageSizeField,
});

export type AdminAssignmentQuery = z.infer<typeof adminAssignmentQuerySchema>;

/**
 * Decision on a class-less assignment request. Members submit these through
 * the public "Submit assignment" form; a platform admin publishes or rejects
 * them before any other visitor can see the row.
 */
export const PUBLIC_ASSIGNMENT_REVIEW_DECISIONS = [
  "approved",
  "rejected",
] as const;

export type PublicAssignmentReviewDecision =
  (typeof PUBLIC_ASSIGNMENT_REVIEW_DECISIONS)[number];

export const publicAssignmentReviewSchema = z
  .object({
    decision: z.enum(PUBLIC_ASSIGNMENT_REVIEW_DECISIONS),
    reason: optionalReviewReason,
    confirmPublic: z.boolean().default(false),
  })
  .strict()
  .refine(
    (value) =>
      value.decision !== "rejected" ||
      (value.reason !== undefined && value.reason.length >= 3),
    {
      message: "A rejection reason of at least 3 characters is required",
      path: ["reason"],
    },
  )
  .refine((value) => value.decision !== "approved" || value.confirmPublic, {
    message: "Confirm that the submission and its attachments may be published",
    path: ["confirmPublic"],
  });

export type PublicAssignmentReviewInput = z.infer<
  typeof publicAssignmentReviewSchema
>;

export const adminApplicationsQuerySchema = z.object({
  search: optionalSearch,
  status: z.enum(["all", ...CLASS_APPLICATION_STATUSES]).default("pending"),
  page: pageField,
  pageSize: pageSizeField,
});

export type AdminApplicationsQuery = z.infer<
  typeof adminApplicationsQuerySchema
>;
