import "server-only";

import type { ExportBrandingInput } from "@starstask/contracts";

import type { ClassSummary } from "@/lib/db/classes";
import {
  getExportBranding,
  upsertExportBranding,
  type ExportBrandingRow,
} from "@/lib/db/export-branding";
import { listActiveUniversities } from "@/lib/db/universities";

import { seedBrandingFromClass, type UniversityRegistryMatch } from "./config";

export type ExportBranding = ExportBrandingRow;

/** Strips persistence metadata; the shape shown in forms and exports. */
export function toBrandingInput(row: ExportBrandingRow): ExportBrandingInput {
  return {
    universityName: row.universityName,
    universityShortName: row.universityShortName,
    universityTagline: row.universityTagline,
    faculty: row.faculty,
    department: row.department,
    studyProgram: row.studyProgram,
    address: row.address,
    city: row.city,
    officialWebsite: row.officialWebsite,
    officialEmail: row.officialEmail,
    contactNumber: row.contactNumber,
    documentTitle: row.documentTitle,
    footerText: row.footerText,
    productName: row.productName,
    productTagline: row.productTagline,
    productLogoUrl: row.productLogoUrl,
    productFooter: row.productFooter,
    brandingEnabled: row.brandingEnabled,
    passingThreshold: row.passingThreshold,
    universityLogoUrl: row.universityLogoUrl,
  };
}

/**
 * Loads what an export should print for one class.
 *
 * A saved row wins. When the class never saved one, the config is seeded from
 * the class's free-text institution and the university registry — read-only,
 * so an export never creates a row as a side effect. Registry failures are
 * swallowed: a branding lookup must never block a download.
 */
export async function loadBrandingForExport(
  classId: string,
  classSummary: Pick<ClassSummary, "institution">,
): Promise<ExportBrandingInput> {
  const saved = await getExportBranding(classId);

  if (saved) {
    return toBrandingInput(saved);
  }

  let matches: UniversityRegistryMatch[] = [];

  try {
    matches = (await listActiveUniversities()).map((university) => ({
      name: university.name,
      shortName: university.shortName,
      city: university.city,
      website: university.website,
    }));
  } catch {
    matches = [];
  }

  return seedBrandingFromClass(classSummary.institution, matches);
}

/**
 * Saves one class's branding. The caller must already have verified the
 * requester manages the class (routes call `requireClassManager`); the RLS
 * write policy is the second gate.
 */
export async function saveBranding(
  classId: string,
  input: ExportBrandingInput,
): Promise<ExportBrandingRow> {
  return upsertExportBranding(classId, input);
}

/** Branding shown in Settings: the saved row, or the seeded defaults. */
export async function getBrandingForClass(
  classId: string,
  classSummary: Pick<ClassSummary, "institution">,
): Promise<ExportBrandingInput> {
  return loadBrandingForExport(classId, classSummary);
}

/** Freshly seeded defaults (institution + registry), ignoring any saved row. */
export async function getSeededBranding(
  classSummary: Pick<ClassSummary, "institution">,
): Promise<ExportBrandingInput> {
  let matches: UniversityRegistryMatch[] = [];

  try {
    matches = (await listActiveUniversities()).map((university) => ({
      name: university.name,
      shortName: university.shortName,
      city: university.city,
      website: university.website,
    }));
  } catch {
    matches = [];
  }

  return seedBrandingFromClass(classSummary.institution, matches);
}
