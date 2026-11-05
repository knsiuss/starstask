import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassAdminPermissionCode } from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { recordServiceRoleAudit } from "@/lib/db/audit";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;

export type AssignClassAdminInput = {
  classId: string;
  universityId: string;
  actorId: string;
  userId?: string;
  studentIdentityId?: string;
  permissionCodes: ClassAdminPermissionCode[];
};

export type AssignClassAdminResult = {
  assignmentId: string;
};

/** 23503 = foreign key violation: cross-tenant or missing identity/user. */
const FK_VIOLATION = "23503";
/** 22023 = raise_exception from guard_last_class_admin. */
const GUARD_REJECTION = "22023";
/** 42703/23505 not expected here; surfaced as generic failure. */

/**
 * Creates a class admin assignment through the service-role client.
 *
 * Authorization is the caller's responsibility (the route verifies
 * `manage_admins` first); this function re-applies tenant keys on every
 * statement and never trusts the client for university scoping. The
 * composite FKs reject cross-university identities and classes.
 */
export async function assignClassAdmin(
  client: ServiceClient,
  input: AssignClassAdminInput,
): Promise<AssignClassAdminResult> {
  if (input.userId) {
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id")
      .eq("id", input.userId)
      .maybeSingle();

    if (profileError) {
      throw new DataAccessError("Could not verify the user", profileError.code);
    }

    if (!profile) {
      throw new InvalidGrantTargetError("User not found.");
    }
  }

  const { data: assignment, error: insertError } = await client
    .from("class_admin_assignments")
    .insert({
      class_id: input.classId,
      university_id: input.universityId,
      user_id: input.userId ?? null,
      student_identity_id: input.studentIdentityId ?? null,
      granted_by: input.actorId,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === FK_VIOLATION) {
      throw new InvalidGrantTargetError(
        "The identity does not belong to this university.",
      );
    }

    throw new DataAccessError(
      "Could not create the admin assignment",
      insertError.code,
    );
  }

  const assignmentId = assignment.id as string;
  const { error: permissionError } = await client
    .from("class_admin_permissions")
    .insert(
      input.permissionCodes.map((code) => ({
        assignment_id: assignmentId,
        permission_code: code,
      })),
    );

  if (permissionError) {
    // Roll back the bare assignment so a permission failure never leaves an
    // admin with zero permissions (an unmanageable, useless grant).
    await client
      .from("class_admin_assignments")
      .delete()
      .eq("id", assignmentId);

    throw new DataAccessError(
      "Could not store the admin permissions",
      permissionError.code,
    );
  }

  await recordServiceRoleAudit(client, {
    actorId: input.actorId,
    action: "class_admin_granted",
    entityType: "class_admin_assignment",
    entityId: assignmentId,
    classId: input.classId,
    universityId: input.universityId,
    metadata: {
      permission_codes: input.permissionCodes,
      user_id: input.userId ?? null,
      student_identity_id: input.studentIdentityId ?? null,
    },
  });

  return { assignmentId };
}

export type RevokeClassAdminInput = {
  classId: string;
  universityId: string;
  actorId: string;
  assignmentId: string;
};

/**
 * Revokes a class admin assignment. The database trigger
 * `guard_last_class_admin` rejects revoking the final active admin; that
 * rejection is surfaced as `LastAdminError` so the route can answer 409.
 */
export async function revokeClassAdmin(
  client: ServiceClient,
  input: RevokeClassAdminInput,
): Promise<void> {
  const { data: assignment, error: loadError } = await client
    .from("class_admin_assignments")
    .select("id, revoked_at")
    .eq("id", input.assignmentId)
    .eq("class_id", input.classId)
    .eq("university_id", input.universityId)
    .maybeSingle();

  if (loadError) {
    throw new DataAccessError(
      "Could not load the admin assignment",
      loadError.code,
    );
  }

  if (!assignment) {
    throw new AssignmentNotFoundError();
  }

  if (assignment.revoked_at) {
    return;
  }

  const { error: updateError } = await client
    .from("class_admin_assignments")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: input.actorId,
    })
    .eq("id", assignment.id)
    .is("revoked_at", null);

  if (updateError) {
    if (updateError.code === GUARD_REJECTION) {
      throw new LastAdminError();
    }

    throw new DataAccessError(
      "Could not revoke the admin assignment",
      updateError.code,
    );
  }

  await recordServiceRoleAudit(client, {
    actorId: input.actorId,
    action: "class_admin_revoked",
    entityType: "class_admin_assignment",
    entityId: assignment.id,
    classId: input.classId,
    universityId: input.universityId,
  });
}

export class InvalidGrantTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGrantTargetError";
  }
}

export class AssignmentNotFoundError extends Error {
  constructor() {
    super("Admin assignment not found.");
    this.name = "AssignmentNotFoundError";
  }
}

export class LastAdminError extends Error {
  constructor() {
    super(
      "This class must keep at least one admin. Assign another admin before revoking this one.",
    );
    this.name = "LastAdminError";
  }
}
