import { z } from "zod";

/**
 * Query contract for the internal developer user directory.
 *
 * The directory is read through the service-role Auth admin API, which has no
 * server-side search or sort. Filters are still validated here before any
 * request is made, and the page size is capped so a crafted URL cannot ask for
 * an unbounded slice.
 */

export const DEVELOPER_SEARCH_MAX = 100;
export const DEVELOPER_PAGE_SIZE = 25;
export const DEVELOPER_PAGE_SIZE_MAX = 100;
export const DEVELOPER_PAGE_MAX = 1000;

export const DEVELOPER_USER_SORTS = ["created_at", "last_sign_in_at"] as const;

export type DeveloperUserSort = (typeof DEVELOPER_USER_SORTS)[number];

export const DEVELOPER_SORT_LABELS: Record<DeveloperUserSort, string> = {
  created_at: "Account created",
  last_sign_in_at: "Last sign-in",
};

export const DEVELOPER_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type DeveloperSortDirection = (typeof DEVELOPER_SORT_DIRECTIONS)[number];

const optionalSearch = z
  .string()
  .trim()
  .max(DEVELOPER_SEARCH_MAX)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

export const developerUsersQuerySchema = z.object({
  search: optionalSearch,
  sort: z.enum(DEVELOPER_USER_SORTS).default("created_at"),
  direction: z.enum(DEVELOPER_SORT_DIRECTIONS).default("desc"),
  page: z.coerce.number().int().min(1).max(DEVELOPER_PAGE_MAX).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(5)
    .max(DEVELOPER_PAGE_SIZE_MAX)
    .default(DEVELOPER_PAGE_SIZE),
});

export type DeveloperUsersQuery = z.infer<typeof developerUsersQuerySchema>;

/**
 * Query contract for the logs page. The event table stores a sanitized route
 * path and error identity only, so a single search term is enough — there are
 * no messages, stacks, or request bodies to filter on.
 */

export const DEVELOPER_LOG_RANGES = ["24h", "7d", "30d", "all"] as const;
export type DeveloperLogRange = (typeof DEVELOPER_LOG_RANGES)[number];

export const DEVELOPER_LOG_RANGE_LABELS: Record<DeveloperLogRange, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All recorded",
};

export const developerLogsQuerySchema = z.object({
  range: z.enum(DEVELOPER_LOG_RANGES).default("30d"),
  search: optionalSearch,
  page: z.coerce.number().int().min(1).max(DEVELOPER_PAGE_MAX).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(5)
    .max(DEVELOPER_PAGE_SIZE_MAX)
    .default(DEVELOPER_PAGE_SIZE),
});

export type DeveloperLogsQuery = z.infer<typeof developerLogsQuerySchema>;

/**
 * Query contract for the security page. Audit trail and recorded auth outcomes
 * live in separate tables, so the source selector picks which stream to page
 * through; both streams share the same pagination shape.
 */

export const DEVELOPER_SECURITY_SOURCES = [
  "audit",
  "auth_failures",
  "auth_successes",
] as const;
export type DeveloperSecuritySource =
  (typeof DEVELOPER_SECURITY_SOURCES)[number];

export const DEVELOPER_SECURITY_SOURCE_LABELS: Record<
  DeveloperSecuritySource,
  string
> = {
  audit: "Audit trail",
  auth_failures: "Failed sign-ins",
  auth_successes: "Successful sign-ins",
};

export const developerSecurityQuerySchema = z.object({
  source: z.enum(DEVELOPER_SECURITY_SOURCES).default("audit"),
  search: optionalSearch,
  page: z.coerce.number().int().min(1).max(DEVELOPER_PAGE_MAX).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(5)
    .max(DEVELOPER_PAGE_SIZE_MAX)
    .default(DEVELOPER_PAGE_SIZE),
});

export type DeveloperSecurityQuery = z.infer<
  typeof developerSecurityQuerySchema
>;

/**
 * Incident payloads. Titles and notes are free text bounded by length checks;
 * the database re-checks the same bounds so a skipped contract cannot widen
 * what is stored.
 */

export const DEVELOPER_INCIDENT_TITLE_MAX = 160;
export const DEVELOPER_INCIDENT_NOTE_MAX = 2000;

export const DEVELOPER_INCIDENT_SEVERITIES = ["low", "medium", "high"] as const;
export type DeveloperIncidentSeverity =
  (typeof DEVELOPER_INCIDENT_SEVERITIES)[number];

export const DEVELOPER_INCIDENT_STATUSES = [
  "open",
  "monitoring",
  "resolved",
] as const;
export type DeveloperIncidentStatus =
  (typeof DEVELOPER_INCIDENT_STATUSES)[number];

export const DEVELOPER_INCIDENT_STATUS_LABELS: Record<
  DeveloperIncidentStatus,
  string
> = {
  open: "Open",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

const incidentTitle = z
  .string()
  .trim()
  .min(3, "Give the incident a title of at least 3 characters.")
  .max(
    DEVELOPER_INCIDENT_TITLE_MAX,
    `Keep the title under ${DEVELOPER_INCIDENT_TITLE_MAX} characters.`,
  );

const incidentNoteBody = z
  .string()
  .trim()
  .min(1, "Write a note first.")
  .max(
    DEVELOPER_INCIDENT_NOTE_MAX,
    `Keep notes under ${DEVELOPER_INCIDENT_NOTE_MAX} characters.`,
  );

export const developerIncidentCreateSchema = z.object({
  title: incidentTitle,
  severity: z.enum(DEVELOPER_INCIDENT_SEVERITIES).default("medium"),
  note: incidentNoteBody.optional(),
});

export type DeveloperIncidentCreate = z.infer<
  typeof developerIncidentCreateSchema
>;

export const developerIncidentStatusSchema = z.object({
  status: z.enum(DEVELOPER_INCIDENT_STATUSES),
});

export type DeveloperIncidentStatusUpdate = z.infer<
  typeof developerIncidentStatusSchema
>;

export const developerIncidentNoteSchema = z.object({
  body: incidentNoteBody,
});

export type DeveloperIncidentNoteInput = z.infer<
  typeof developerIncidentNoteSchema
>;

export const DEVELOPER_INCIDENT_STATUS_FILTERS = [
  "all",
  ...DEVELOPER_INCIDENT_STATUSES,
] as const;

export type IncidentStatusFilter =
  (typeof DEVELOPER_INCIDENT_STATUS_FILTERS)[number];
