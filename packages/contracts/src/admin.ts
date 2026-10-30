import { z } from "zod";

import { CLASS_APPLICATION_STATUSES, CLASS_STATUSES } from "./classes";

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
 * Statuses an admin assignment row can hold. `pending` is the legacy
 * pre-review state kept by the schema so old rows stay visible.
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
  pending: "Pending (legacy)",
  published: "Published",
  rejected: "Rejected",
  unpublished: "Unpublished",
  archived: "Archived",
};

export const adminClassesQuerySchema = z.object({
  search: optionalSearch,
  status: z.enum(["all", ...CLASS_STATUSES]).default("all"),
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

export const adminApplicationsQuerySchema = z.object({
  search: optionalSearch,
  status: z.enum(["all", ...CLASS_APPLICATION_STATUSES]).default("pending"),
  page: pageField,
  pageSize: pageSizeField,
});

export type AdminApplicationsQuery = z.infer<
  typeof adminApplicationsQuerySchema
>;
