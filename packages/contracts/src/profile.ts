import { z } from "zod";

export const PROFILE_FULL_NAME_MIN = 2;
export const PROFILE_FULL_NAME_MAX = 80;
export const PROFILE_NICKNAME_MIN = 2;
export const PROFILE_NICKNAME_MAX = 60;
export const PROFILE_NIM_MIN = 3;
export const PROFILE_NIM_MAX = 32;
export const PROFILE_UNIVERSITY_MIN = 2;
export const PROFILE_UNIVERSITY_MAX = 120;
export const PROFILE_CLASS_NAME_MAX = 60;
export const PROFILE_BIO_MAX = 280;

export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_AVATAR_MIME_TYPES = ["image/png", "image/jpeg"] as const;

export type ProfileAvatarMimeType = (typeof PROFILE_AVATAR_MIME_TYPES)[number];

/**
 * A conservative NIM shape, not a university-specific rule.
 *
 * Letters, digits, dot, underscore, and hyphen; leading zeros are kept because
 * the value is always handled as text.
 */
export const PROFILE_NIM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;

/** A NIM shorter than this is masked completely rather than mostly revealed. */
export const NIM_MASK_MIN_VISIBLE_LENGTH = 8;

/**
 * The one definition of "the same class name", used for the student's typed
 * input and for stored class identifiers alike.
 *
 * Lowercase, then keep only letters and digits, so case, surrounding or
 * repeated whitespace, and separators stop mattering. Genuinely different
 * identifiers stay different: `IF-24-01` and `IF-24-1` do not collide.
 *
 * `packages/contracts` cannot import the SQL function it mirrors, so the two
 * must change together; the normalization tests pin the shared behaviour.
 */
export function normalizeClassKey(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");

  return normalized.length > 0 ? normalized : null;
}

/**
 * Masks a student ID for any surface that is not the owner's own private view.
 *
 * The last four characters stay visible when the value is long enough to make
 * that safe; anything shorter is masked in full so a short NIM is not mostly
 * revealed. `********0767` is the intended shape.
 */
export function maskNim(nim: string): string {
  const trimmed = nim.trim();

  if (trimmed.length === 0) {
    return "";
  }

  if (trimmed.length < NIM_MASK_MIN_VISIBLE_LENGTH) {
    return "*".repeat(trimmed.length);
  }

  return `${"*".repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}

const requiredText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or fewer`);

/**
 * The onboarding form payload.
 *
 * The class name is optional: a profile is complete without a class, and an
 * unmatched name is stored as the student typed it rather than dropped.
 */
export const profileOnboardingSchema = z.object({
  fullName: requiredText(
    "Full name",
    PROFILE_FULL_NAME_MIN,
    PROFILE_FULL_NAME_MAX,
  ),
  nickname: requiredText(
    "Nickname",
    PROFILE_NICKNAME_MIN,
    PROFILE_NICKNAME_MAX,
  ),
  nim: z
    .string()
    .trim()
    .min(PROFILE_NIM_MIN, "Enter your NIM")
    .max(PROFILE_NIM_MAX, `NIM must be ${PROFILE_NIM_MAX} characters or fewer`)
    .regex(
      PROFILE_NIM_PATTERN,
      "Use letters, digits, dot, underscore, or hyphen",
    ),
  university: requiredText(
    "University",
    PROFILE_UNIVERSITY_MIN,
    PROFILE_UNIVERSITY_MAX,
  ),
  className: z
    .string()
    .trim()
    .max(
      PROFILE_CLASS_NAME_MAX,
      `Class must be ${PROFILE_CLASS_NAME_MAX} characters or fewer`,
    )
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? undefined : value,
    ),
});

export type ProfileOnboardingInput = z.infer<typeof profileOnboardingSchema>;

/**
 * The owner's own onboarding state, as returned by `get_my_profile` and
 * `update_my_profile`. Private fields (full name, NIM) appear here only because
 * the caller is the authenticated owner.
 */
export const myProfileSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().nullable(),
  nickname: z.string(),
  nim: z.string().nullable(),
  university: z.string().nullable(),
  declaredClassName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable().default(null),
  onboardedAt: z.string().nullable(),
});

export type MyProfile = z.infer<typeof myProfileSchema>;

/**
 * The bio form payload. An empty string clears the bio; the database stores
 * NULL rather than a row of whitespace.
 */
export const profileBioSchema = z.object({
  bio: z
    .string()
    .trim()
    .max(PROFILE_BIO_MAX, `Bio must be ${PROFILE_BIO_MAX} characters or fewer`)
    .transform((value) => (value.length === 0 ? null : value)),
});

export type ProfileBioInput = z.infer<typeof profileBioSchema>;

export const CLASS_JOIN_STATUSES = [
  "joined",
  "already_member",
  "no_match",
  "ambiguous",
  "blocked_by_policy",
] as const;

export type ClassJoinStatus = (typeof CLASS_JOIN_STATUSES)[number];

const joinCandidateSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
});

const joinMatchSchema = z.object({
  status: z.enum(["joined", "already_member", "blocked_by_policy"]),
  classId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
});

/**
 * What `join_class_by_name` reports back.
 *
 * Parsing the RPC result with this schema keeps the UI honest: an unexpected
 * shape becomes a save-level error instead of an invented "joined" state.
 */
export const classJoinResultSchema = z.discriminatedUnion("status", [
  joinMatchSchema,
  z.object({ status: z.literal("no_match") }),
  z.object({
    status: z.literal("ambiguous"),
    candidates: z.array(joinCandidateSchema).min(1),
  }),
]);

export type ClassJoinResult = z.infer<typeof classJoinResultSchema>;
