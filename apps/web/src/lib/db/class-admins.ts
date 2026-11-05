import "server-only";

import type { ClassAdminPermissionCode } from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClassAdminAssignmentRow = {
  id: string;
  userId: string | null;
  studentIdentityId: string | null;
  grantedBy: string;
  grantedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  permissionCodes: ClassAdminPermissionCode[];
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * All assignments on the class (active and revoked), active first.
 *
 * Readable by class members / university members under RLS; the page decides
 * who may see it. Names are resolved from profiles for human recognisability;
 * identity-only rows without a linked account show the identity id prefix.
 */
export async function listClassAdminAssignments(
  classId: string,
): Promise<ClassAdminAssignmentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_admin_assignments")
    .select(
      "id, user_id, student_identity_id, granted_by, granted_at, revoked_at, revoked_by",
    )
    .eq("class_id", classId)
    .order("revoked_at", { ascending: true, nullsFirst: true })
    .order("granted_at", { ascending: false });

  if (error) {
    throw new DataAccessError("Could not load class admins", error.code);
  }

  const assignments = data ?? [];

  if (assignments.length === 0) {
    return [];
  }

  const ids = assignments.map((row) => row.id);
  const { data: permissionRows, error: permissionError } = await supabase
    .from("class_admin_permissions")
    .select("assignment_id, permission_code")
    .in("assignment_id", ids);

  if (permissionError) {
    throw new DataAccessError(
      "Could not load class admin permissions",
      permissionError.code,
    );
  }

  const permissionsByAssignment = new Map<string, ClassAdminPermissionCode[]>();

  for (const row of permissionRows ?? []) {
    const list = permissionsByAssignment.get(row.assignment_id) ?? [];
    list.push(row.permission_code as ClassAdminPermissionCode);
    permissionsByAssignment.set(row.assignment_id, list);
  }

  const profileIds = assignments.flatMap((row) =>
    [row.user_id, row.granted_by, row.revoked_by].filter((id): id is string =>
      Boolean(id),
    ),
  );
  const profiles = await loadProfiles(profileIds);

  return assignments.map((row) => {
    const profile = row.user_id ? profiles.get(row.user_id) : undefined;

    return {
      id: row.id,
      userId: row.user_id,
      studentIdentityId: row.student_identity_id,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
      revokedBy: row.revoked_by,
      permissionCodes: permissionsByAssignment.get(row.id) ?? [],
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });
}

/**
 * Resolves a student identity to its tenant key, or null when it does not
 * exist. Used by grant flows to enforce same-university assignment.
 */
export async function getStudentIdentityUniversity(
  identityId: string,
): Promise<{ id: string; universityId: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_identities")
    .select("id, university_id")
    .eq("id", identityId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not load the student identity",
      error.code,
    );
  }

  return data ? { id: data.id, universityId: data.university_id } : null;
}
