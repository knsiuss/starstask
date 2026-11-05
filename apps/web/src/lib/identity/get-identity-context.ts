import "server-only";

import { cache } from "react";

import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DataAccessError } from "@/lib/db/assignments";
import {
  deriveIdentityContext,
  type IdentityContext,
  type MembershipRow,
  type StudentIdentityRow,
  type UniversityRow,
} from "@/lib/identity/derive-identity-context";

export type ResolvedIdentityContext =
  { authenticated: false } | { authenticated: true; context: IdentityContext };

/**
 * Resolves the caller's academic identity context for the current request.
 *
 * Reads only what RLS exposes: own membership rows, own student identities,
 * and the universities readable to the caller (status = 'active'). A university
 * row that is missing is treated as not active — never fetched with elevated
 * privileges. Nothing here creates memberships or identities.
 *
 * Returns `authenticated: false` when there is no verified session or Supabase
 * is not configured; callers decide whether to redirect.
 */
export const getIdentityContext = cache(
  async (): Promise<ResolvedIdentityContext> => {
    const session = await getSessionUser();

    if (!session) {
      return { authenticated: false };
    }

    const supabase = await createSupabaseServerClient();
    const { data: membershipRows, error: membershipError } = await supabase
      .from("university_memberships")
      .select("id, university_id, role, status, entry_year, student_id")
      .order("created_at", { ascending: true });

    if (membershipError) {
      throw new DataAccessError(
        "Could not load your memberships",
        membershipError.code,
      );
    }

    const memberships = (membershipRows ?? []) as MembershipRow[];
    const universityIds = [
      ...new Set(memberships.map((row) => row.university_id)),
    ];

    let universities: UniversityRow[] = [];

    if (universityIds.length > 0) {
      const { data: universityRows, error: universityError } = await supabase
        .from("universities")
        .select("id, slug, name, short_name, status, timezone")
        .in("id", universityIds);

      if (universityError) {
        throw new DataAccessError(
          "Could not load university details",
          universityError.code,
        );
      }

      universities = (universityRows ?? []) as UniversityRow[];
    }

    const activeMemberships = memberships.filter(
      (row) => row.status === "active",
    );

    const onlyActive =
      activeMemberships.length === 1 ? activeMemberships[0] : undefined;

    let identities: StudentIdentityRow[] = [];

    if (onlyActive) {
      const { data: identityRows, error: identityError } = await supabase
        .from("student_identities")
        .select(
          "id, university_membership_id, academic_unit_id, student_id, entry_year, status",
        )
        .eq("university_membership_id", onlyActive.id);

      if (identityError) {
        throw new DataAccessError(
          "Could not load your academic identity",
          identityError.code,
        );
      }

      identities = (identityRows ?? []) as StudentIdentityRow[];
    }

    return {
      authenticated: true,
      context: deriveIdentityContext({
        hasProfile: session.profile !== null,
        memberships,
        universities,
        identities,
      }),
    };
  },
);
