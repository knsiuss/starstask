/**
 * Pure derivation of the caller's academic identity context.
 *
 * Kept free of I/O so the decision table (no profile / no membership /
 * multi-membership / suspended / inactive university / missing identity) can be
 * unit-tested without a database. The server wrapper lives in
 * `get-identity-context.ts`.
 */

export type MembershipRow = {
  id: string;
  university_id: string;
  role: string;
  status: string;
  entry_year: number | null;
  student_id: string | null;
};

export type UniversityRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  status: string;
  timezone: string | null;
};

export type StudentIdentityRow = {
  id: string;
  university_membership_id: string;
  academic_unit_id: string | null;
  student_id: string;
  entry_year: number | null;
  status: string;
};

export type UniversitySummary = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  status: string;
  timezone: string | null;
};

export type MembershipSummary = {
  id: string;
  universityId: string;
  university: UniversitySummary | null;
  role: string;
  status: string;
  entryYear: number | null;
  studentId: string | null;
};

export type StudentIdentitySummary = {
  id: string;
  studentId: string;
  entryYear: number | null;
  status: string;
  academicUnitId: string | null;
};

export type IdentityContext =
  | { status: "missing_profile" }
  | { status: "no_membership" }
  | {
      status: "multiple_active_memberships";
      memberships: MembershipSummary[];
    }
  | {
      /** Memberships exist but none is active (pending / suspended / graduated). */
      status: "no_active_membership";
      memberships: MembershipSummary[];
    }
  | {
      /**
       * The single active membership points at a university the caller cannot
       * read as `active` (RLS hides non-active rows, or the row is missing).
       */
      status: "inactive_university";
      membership: MembershipSummary;
    }
  | {
      status: "active";
      membership: MembershipSummary;
      university: UniversitySummary;
      /** NULL when the persona exists but the platform RPC has not provisioned
       *  an academic identity yet. Never auto-created by the app. */
      identity: StudentIdentitySummary | null;
    };

export type DeriveIdentityInput = {
  hasProfile: boolean;
  memberships: MembershipRow[];
  /** Rows readable under RLS. Non-active universities are absent by design. */
  universities: UniversityRow[];
  /** At most the identity for the single active membership. */
  identities: StudentIdentityRow[];
};

function toUniversitySummary(row: UniversityRow): UniversitySummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    status: row.status,
    timezone: row.timezone,
  };
}

function toMembershipSummary(
  row: MembershipRow,
  universities: Map<string, UniversityRow>,
): MembershipSummary {
  const university = universities.get(row.university_id);

  return {
    id: row.id,
    universityId: row.university_id,
    university: university ? toUniversitySummary(university) : null,
    role: row.role,
    status: row.status,
    entryYear: row.entry_year,
    studentId: row.student_id,
  };
}

export function deriveIdentityContext(
  input: DeriveIdentityInput,
): IdentityContext {
  if (!input.hasProfile) {
    return { status: "missing_profile" };
  }

  const universities = new Map(input.universities.map((row) => [row.id, row]));
  const memberships = input.memberships.map((row) =>
    toMembershipSummary(row, universities),
  );

  if (memberships.length === 0) {
    return { status: "no_membership" };
  }

  const active = memberships.filter(
    (membership) => membership.status === "active",
  );

  if (active.length > 1) {
    // Never pick one arbitrarily (decision register #8/#7): the caller must
    // show a disambiguation notice instead of academic data.
    return { status: "multiple_active_memberships", memberships: active };
  }

  if (active.length === 0) {
    return { status: "no_active_membership", memberships };
  }

  const membership = active[0];

  if (!membership) {
    return { status: "no_active_membership", memberships };
  }
  const university = membership.university;

  if (!university || university.status !== "active") {
    return { status: "inactive_university", membership };
  }

  const identityRow = input.identities.find(
    (row) => row.university_membership_id === membership.id,
  );

  return {
    status: "active",
    membership,
    university,
    identity: identityRow
      ? {
          id: identityRow.id,
          studentId: identityRow.student_id,
          entryYear: identityRow.entry_year,
          status: identityRow.status,
          academicUnitId: identityRow.academic_unit_id,
        }
      : null,
  };
}
