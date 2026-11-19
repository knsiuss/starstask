import { z } from "zod";

/**
 * Optional free text that treats a blank value as absent.
 *
 * Lecturers see empty optional fields as "not set"; the RPCs store NULL in
 * that case, so "" must not reach the database as a value violating the
 * column CHECK constraints (2 to 120 for institution, 1 to 120 for name).
 */
const optionalText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer`)
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? undefined : value,
    )
    .refine((value) => value === undefined || value.length >= min, {
      message: `Use at least ${min} characters or leave it empty`,
    });

/**
 * Lecturer self-service class creation payload.
 *
 * Mirrors studentCreateClassSchema (semester, academicYear, courseName,
 * description, classCode) but stays flat: the class name is free-form and
 * classCode is optional because lecturers are a trusted persona and are not
 * bound to the student cohort code format. The eight-active-class cap does
 * not apply; create_class_as_lecturer enforces an active lecturer or
 * university_admin membership instead. joinPolicy is accepted for symmetry
 * with the student flow, but the RPC does not take it (classes default to
 * 'invitation') and the route never forwards it.
 */
export const lecturerCreateClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Class name must be at least 3 characters")
    .max(120, "Class name must be 120 characters or fewer"),
  courseName: z
    .string()
    .trim()
    .min(2, "Course name must be at least 2 characters")
    .max(120, "Course name must be 120 characters or fewer"),
  semester: z
    .string()
    .trim()
    .min(1, "Semester is required")
    .max(20, "Semester must be 20 characters or fewer"),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, "Use the format 2026/2027"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must be 5000 characters or fewer"),
  classCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9]{2,20}$/,
      "Use 2 to 20 letters or numbers (for example TPLM002)",
    )
    .optional(),
  institution: optionalText(2, 120),
  lecturerName: optionalText(1, 120),
  joinPolicy: z.enum(["invitation", "open"]).default("invitation"),
  universityId: z.uuid("Invalid university id").optional(),
});

export type LecturerCreateClassInput = z.infer<
  typeof lecturerCreateClassSchema
>;
