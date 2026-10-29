import { z } from "zod";

export const ASSIGNMENT_TYPES = [
  "individual",
  "group",
  "lab",
  "project",
  "presentation",
  "exam",
  "other",
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const ASSIGNMENT_STATUSES = ["published", "pending"] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_SORTS = ["newest", "oldest", "deadline"] as const;

export type AssignmentSort = (typeof ASSIGNMENT_SORTS)[number];

export const ASSIGNMENT_TITLE_MAX = 200;
export const ASSIGNMENT_DESCRIPTION_MIN = 10;
export const ASSIGNMENT_DESCRIPTION_MAX = 20_000;
export const ASSIGNMENT_TAGS_MAX = 10;
export const ASSIGNMENT_TAG_MAX = 32;
export const ASSIGNMENT_REFERENCES_MAX = 10;
export const ASSIGNMENT_ATTACHMENTS_MAX = 3;
export const ASSIGNMENT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Extensions accepted by the upload endpoint, kept in sync with storage MIME rules. */
export const ATTACHMENT_ALLOWED_EXTENSIONS = [
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "png",
  "jpg",
  "jpeg",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const safeUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => isSafeHttpUrl(value), {
    message: "Enter a valid http(s) URL",
  });

export const referenceUrlListSchema = z
  .array(z.union([safeUrlSchema, z.literal("")]))
  .max(ASSIGNMENT_REFERENCES_MAX, "Use at most 10 reference links")
  .transform((urls) => urls.filter((url) => url.length > 0));

/**
 * Accepts an ISO-8601 timestamp that carries an explicit offset (for example
 * `2026-10-29T16:59:00.000Z` or `2026-10-29T23:59:00+07:00`).
 *
 * A bare `datetime-local` value is rejected on purpose: without an offset the
 * server cannot know which instant the contributor meant.
 */
export const isoDateTimeWithOffsetSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) && !Number.isNaN(Date.parse(value)),
    { message: "Enter a valid date and time" },
  );

export const assignmentCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(ASSIGNMENT_TITLE_MAX, "Title must be 200 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(
      ASSIGNMENT_DESCRIPTION_MIN,
      "Description must be at least 10 characters",
    )
    .max(
      ASSIGNMENT_DESCRIPTION_MAX,
      "Description must be 20,000 characters or fewer",
    ),
  courseName: z
    .string()
    .trim()
    .min(2, "Course name is required")
    .max(120, "Course name must be 120 characters or fewer"),
  courseCode: optionalText(20),
  department: optionalText(120),
  lecturerName: optionalText(120),
  semester: optionalText(20),
  academicYear: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .refine((value) => value === undefined || /^\d{4}\/\d{4}$/.test(value), {
      message: "Use the format 2025/2026",
    }),
  assignmentType: z.enum(ASSIGNMENT_TYPES).optional(),
  deadline: isoDateTimeWithOffsetSchema.optional(),
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
});

export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;

/**
 * Update payloads may not change ownership or publication status. Omitting a
 * field leaves the stored value untouched; passing `null` clears an optional
 * field. `title`, `description`, and `courseName` are therefore optional here,
 * but when present they are validated with the same rules as creation.
 */
export const assignmentUpdateSchema = z
  .object({
    title: assignmentCreateSchema.shape.title.optional(),
    description: assignmentCreateSchema.shape.description.optional(),
    courseName: assignmentCreateSchema.shape.courseName.optional(),
    courseCode: z.string().trim().max(20).nullable().optional(),
    department: z.string().trim().max(120).nullable().optional(),
    lecturerName: z.string().trim().max(120).nullable().optional(),
    semester: z.string().trim().max(20).nullable().optional(),
    academicYear: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Use the format 2025/2026")
      .nullable()
      .optional(),
    assignmentType: z.enum(ASSIGNMENT_TYPES).nullable().optional(),
    deadline: isoDateTimeWithOffsetSchema.nullable().optional(),
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
      .transform((tags) =>
        tags === undefined ? undefined : normalizeTags(tags),
      ),
    referenceUrls: referenceUrlListSchema
      .optional()
      .transform((urls) => (urls === undefined ? undefined : urls)),
  })
  .strict();

export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;

export const assignmentIdSchema = z.uuid("Invalid assignment id");

export const courseIdSchema = z.uuid("Invalid course id");

export const semesterSchema = z.string().trim().max(20);

export const listAssignmentsQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100, "Search must be 100 characters or fewer")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  course: courseIdSchema.optional(),
  /** Restricts discovery to one class's published assignments. */
  class: z.uuid("Invalid class id").optional(),
  semester: semesterSchema
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  type: z.enum(ASSIGNMENT_TYPES).optional(),
  tag: z
    .string()
    .trim()
    .max(ASSIGNMENT_TAG_MAX)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  sort: z.enum(ASSIGNMENT_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
});

export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;

export const myAssignmentsQuerySchema = z.object({
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type MyAssignmentsQuery = z.infer<typeof myAssignmentsQuerySchema>;

/** Normalizes tags: trims, drops empties, de-duplicates case-insensitively. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    const tag = raw.trim();
    const key = tag.toLowerCase();

    if (!tag || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(tag);
  }

  return result;
}

/**
 * Only absolute http(s) URLs are allowed. `javascript:`, `data:`, and protocol
 * relative URLs are rejected so a stored reference link can never execute code
 * or silently resolve against the current origin.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Converts Zod issues into `{ field: firstMessage }` for form rendering. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";

    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}
