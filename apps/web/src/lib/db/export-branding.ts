import "server-only";

import type { ExportBrandingInput } from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** One row of `class_export_branding`, already camelCased for the app. */
export type ExportBrandingRow = ExportBrandingInput & {
  classId: string;
  createdAt: string;
  updatedAt: string;
};

const BRANDING_COLUMNS =
  "class_id, university_name, university_short_name, university_tagline, faculty, department, study_program, address, city, official_website, official_email, contact_number, document_title, footer_text, product_name, product_tagline, product_logo_url, product_footer, branding_enabled, passing_threshold, university_logo_url, created_at, updated_at";

type BrandingDbRow = {
  class_id: string;
  university_name: string;
  university_short_name: string | null;
  university_tagline: string | null;
  faculty: string | null;
  department: string | null;
  study_program: string | null;
  address: string | null;
  city: string | null;
  official_website: string | null;
  official_email: string | null;
  contact_number: string | null;
  document_title: string;
  footer_text: string | null;
  product_name: string;
  product_tagline: string;
  product_logo_url: string;
  product_footer: string | null;
  branding_enabled: boolean;
  passing_threshold: number;
  university_logo_url: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: BrandingDbRow): ExportBrandingRow {
  return {
    classId: row.class_id,
    universityName: row.university_name ?? "",
    universityShortName: row.university_short_name ?? null,
    universityTagline: row.university_tagline ?? null,
    faculty: row.faculty ?? null,
    department: row.department ?? null,
    studyProgram: row.study_program ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    officialWebsite: row.official_website ?? null,
    officialEmail: row.official_email ?? null,
    contactNumber: row.contact_number ?? null,
    documentTitle: row.document_title,
    footerText: row.footer_text ?? null,
    productName: row.product_name,
    productTagline: row.product_tagline,
    productLogoUrl: row.product_logo_url,
    productFooter: row.product_footer ?? null,
    brandingEnabled: row.branding_enabled,
    passingThreshold: Number(row.passing_threshold),
    universityLogoUrl: row.university_logo_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Reads one class's saved branding row, or null when it never saved one.
 * Reads go through RLS (class members); writes go through the manager check
 * in `saveBranding` plus RLS.
 */
export async function getExportBranding(
  classId: string,
): Promise<ExportBrandingRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_export_branding")
    .select(BRANDING_COLUMNS)
    .eq("class_id", classId)
    .maybeSingle<BrandingDbRow>();

  if (error) {
    throw new DataAccessError("Could not load export branding", error.code);
  }

  return data ? mapRow(data) : null;
}

/** Inserts or replaces the class's branding row. The caller checks managing. */
export async function upsertExportBranding(
  classId: string,
  input: ExportBrandingInput,
): Promise<ExportBrandingRow> {
  const supabase = await createSupabaseServerClient();
  const payload = {
    class_id: classId,
    university_name: input.universityName,
    university_short_name: input.universityShortName,
    university_tagline: input.universityTagline,
    faculty: input.faculty,
    department: input.department,
    study_program: input.studyProgram,
    address: input.address,
    city: input.city,
    official_website: input.officialWebsite,
    official_email: input.officialEmail,
    contact_number: input.contactNumber,
    document_title: input.documentTitle,
    footer_text: input.footerText,
    product_name: input.productName,
    product_tagline: input.productTagline,
    product_logo_url: input.productLogoUrl,
    product_footer: input.productFooter,
    branding_enabled: input.brandingEnabled,
    passing_threshold: input.passingThreshold,
    university_logo_url: input.universityLogoUrl,
  };

  const { data, error } = await supabase
    .from("class_export_branding")
    .upsert(payload, { onConflict: "class_id" })
    .select(BRANDING_COLUMNS)
    .single<BrandingDbRow>();

  if (error || !data) {
    throw new DataAccessError(
      "Could not save export branding",
      error?.code ?? "unknown",
    );
  }

  return mapRow(data);
}
