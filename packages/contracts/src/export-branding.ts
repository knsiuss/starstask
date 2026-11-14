import { z } from "zod";

/** Institutional branding for the Excel attendance/grade export. */
export const DEFAULT_DOCUMENT_TITLE =
  "Lembar Rekapitulasi Kehadiran dan Nilai Mahasiswa";
export const DEFAULT_PRODUCT_NAME = "Aphelion";
export const DEFAULT_PRODUCT_TAGLINE = "Academic Productivity";
export const DEFAULT_PRODUCT_LOGO_URL = "/aphelion-logo.png";
export const DEFAULT_PASSING_THRESHOLD = 60;
export const MIN_PASSING_THRESHOLD = 0;
export const MAX_PASSING_THRESHOLD = 100;

const DEFAULT_FOOTER = "{university} | Aphelion Academic System";

/** Empty text fields become null so the UI never shows a phantom value. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) =>
      value === undefined || value === null || value === "" ? null : value,
    );

const optionalUrl = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) =>
      value === undefined || value === null || value === "" ? null : value,
    )
    .refine((value) => value === null || isHttpUrl(value), {
      message: `${label} must be a valid URL`,
    });

const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .nullish()
  .transform((value) =>
    value === undefined || value === null || value === "" ? null : value,
  )
  .refine((value) => value === null || z.email().safeParse(value).success, {
    message: "Enter a valid email address",
  });

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Logo references only: an https URL, a site path ("/..."), or empty.
 * Relative paths keep stored logos portable across environments.
 */
const logoUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(600)
    .nullish()
    .transform((value) => (value === undefined || value === null ? "" : value))
    .refine(
      (value) =>
        value === "" || value.startsWith("https://") || value.startsWith("/"),
      { message: `${label} must be an https URL or a site path` },
    );

/**
 * Validates the branding payload at the API boundary and applies the product
 * defaults. The threshold is clamped rather than rejected, so a stray value
 * can never break an export.
 */
export const exportBrandingSchema = z.object({
  universityName: z
    .string()
    .trim()
    .max(160)
    .nullish()
    .transform((value) => (value ? value.trim() : "")),
  universityShortName: optionalText(60),
  universityTagline: optionalText(160),
  faculty: optionalText(160),
  department: optionalText(160),
  studyProgram: optionalText(160),
  address: optionalText(300),
  city: optionalText(120),
  officialWebsite: optionalUrl(300, "Official website"),
  officialEmail: optionalEmail,
  contactNumber: optionalText(60),
  documentTitle: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((value) => (value ? value.trim() : DEFAULT_DOCUMENT_TITLE)),
  footerText: optionalText(300),
  productName: z
    .string()
    .trim()
    .max(80)
    .nullish()
    .transform((value) =>
      value?.trim() ? value.trim() : DEFAULT_PRODUCT_NAME,
    ),
  productTagline: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((value) =>
      value?.trim() ? value.trim() : DEFAULT_PRODUCT_TAGLINE,
    ),
  productLogoUrl: logoUrl("Product logo URL").transform((value) =>
    value === "" ? DEFAULT_PRODUCT_LOGO_URL : value,
  ),
  productFooter: optionalText(300),
  brandingEnabled: z
    .boolean()
    .nullish()
    .transform((value) => value ?? true),
  passingThreshold: z
    .number()
    .nullish()
    .transform((value) => value ?? DEFAULT_PASSING_THRESHOLD)
    .transform((value) =>
      Math.min(MAX_PASSING_THRESHOLD, Math.max(MIN_PASSING_THRESHOLD, value)),
    ),
  universityLogoUrl: logoUrl("University logo URL"),
});

export type ExportBrandingInput = z.infer<typeof exportBrandingSchema>;

/**
 * Default footer line. The `{university}` token is replaced with the saved
 * university name when the row is rendered.
 */
export const DEFAULT_FOOTER_TEMPLATE = DEFAULT_FOOTER;
