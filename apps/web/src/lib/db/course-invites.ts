import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DataAccessError } from "@/lib/db/assignments";
import { recordServiceRoleAudit } from "@/lib/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;

export type CourseInviteTokenRow = {
  id: string;
  universityId: string;
  offeringId: string;
  /** Never the hash — the row id is the only identifier the UI shows. */
  status: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

/**
 * Invite tokens for the platform-admin console. The usage policy is
 * unresolved, so creation stays disabled; this is the safe read surface.
 * `token_hash` is intentionally never selected.
 */
export async function listCourseInviteTokens(
  universityId?: string,
  limit = 100,
): Promise<CourseInviteTokenRow[]> {
  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from("course_invite_tokens")
    .select(
      "id, university_id, offering_id, status, max_uses, use_count, expires_at, created_at, revoked_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (universityId) {
    request = request.eq("university_id", universityId);
  }

  const { data, error } = await request;

  if (error) {
    throw new DataAccessError("Could not load invite tokens", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    universityId: row.university_id,
    offeringId: row.offering_id,
    status: row.status,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  }));
}

/**
 * Revokes an active invite token. Revocation only invalidates — it never
 * creates, redeems or extends anything, so it is allowed while the usage
 * policy is unresolved.
 */
export async function revokeCourseInviteToken(
  client: ServiceClient,
  actorId: string,
  tokenId: string,
): Promise<"revoked" | "not_found" | "already_inactive"> {
  const { data: token, error: loadError } = await client
    .from("course_invite_tokens")
    .select("id, status, university_id")
    .eq("id", tokenId)
    .maybeSingle();

  if (loadError) {
    throw new DataAccessError(
      "Could not load the invite token",
      loadError.code,
    );
  }

  if (!token) {
    return "not_found";
  }

  if (token.status !== "active") {
    return "already_inactive";
  }

  const { error: updateError } = await client
    .from("course_invite_tokens")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: actorId,
    })
    .eq("id", token.id)
    .eq("status", "active");

  if (updateError) {
    throw new DataAccessError(
      "Could not revoke the invite token",
      updateError.code,
    );
  }

  await recordServiceRoleAudit(client, {
    actorId,
    action: "course_invite_revoked",
    entityType: "course_invite_token",
    entityId: token.id,
    classId: null,
    universityId: token.university_id,
  });

  return "revoked";
}
