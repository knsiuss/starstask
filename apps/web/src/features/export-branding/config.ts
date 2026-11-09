import {
  DEFAULT_DOCUMENT_TITLE,
  DEFAULT_PASSING_THRESHOLD,
  DEFAULT_PRODUCT_LOGO_URL,
  DEFAULT_PRODUCT_NAME,
  DEFAULT_PRODUCT_TAGLINE,
  type ExportBrandingInput,
} from "@starstask/contracts";

/** A registry row the seeder can match a free-text institution against. */
export type UniversityRegistryMatch = {
  name: string;
  shortName: string | null;
  city: string | null;
  website: string | null;
};

/**
 * Builds the full branding config for a class that has no saved row yet.
 *
 * The class's free-text institution supplies the university name. A registry
 * match (by name, short name, or containment) adds city and website when it
 * exists. Nothing fabricated: unknown fields stay empty.
 */
export function seedBrandingFromClass(
  institution: string | null | undefined,
  universityMatches: UniversityRegistryMatch[] = [],
): ExportBrandingInput {
  const normalizedInstitution = (institution ?? "").trim();

  const match =
    normalizedInstitution === ""
      ? null
      : (universityMatches.find(
          (candidate) =>
            candidate.name.trim().toLowerCase() ===
              normalizedInstitution.toLowerCase() ||
            (candidate.shortName !== null &&
              candidate.shortName.trim().toLowerCase() ===
                normalizedInstitution.toLowerCase()),
        ) ??
        universityMatches.find(
          (candidate) =>
            candidate.name
              .trim()
              .toLowerCase()
              .includes(normalizedInstitution.toLowerCase()) ||
            normalizedInstitution
              .toLowerCase()
              .includes(candidate.name.trim().toLowerCase()),
        ) ??
        null);

  const universityName = match?.name ?? normalizedInstitution;

  return {
    universityName,
    universityShortName: match?.shortName ?? null,
    universityTagline: null,
    faculty: null,
    department: null,
    studyProgram: null,
    address: null,
    city: match?.city ?? null,
    officialWebsite: match?.website ?? null,
    officialEmail: null,
    contactNumber: null,
    documentTitle: DEFAULT_DOCUMENT_TITLE,
    footerText: universityName
      ? `${universityName} | ${DEFAULT_PRODUCT_NAME} Academic System`
      : `${DEFAULT_PRODUCT_NAME} Academic System`,
    productName: DEFAULT_PRODUCT_NAME,
    productTagline: DEFAULT_PRODUCT_TAGLINE,
    productLogoUrl: DEFAULT_PRODUCT_LOGO_URL,
    productFooter: null,
    brandingEnabled: true,
    passingThreshold: DEFAULT_PASSING_THRESHOLD,
    universityLogoUrl: "",
  };
}

/** Renders the saved footer text, expanding the optional `{university}` token. */
export function resolveFooterText(input: ExportBrandingInput): string {
  const footer = input.footerText?.trim();

  if (!footer) {
    return `${input.universityName || DEFAULT_PRODUCT_NAME} | ${input.productName} Academic System`;
  }

  return footer.replaceAll(
    "{university}",
    input.universityName || "Universitas",
  );
}
