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
 * Invite tokens for the platform-admin console. Usage policy APPROVED
 * 2026-11-05 (ADR-002): max_uses default 50, expires +30 days, explicit
 * values required at creation (no silent default in DB — enforced here).
 * `token_hash` is intentionally never selected.
 */
export const INVITE_DEFAULT_MAX_USES = 50;
export const INVITE_DEFAULT_EXPIRES_DAYS = 30;

export async function createCourseInviteToken(
  client: ServiceClient,
  actorId: string,
  input: {
    universityId: string;
    offeringId: string;
    maxUses?: number;
    expiresAt?: string;
  },
): Promise<{ id: string; token: string }> {
  const maxUses = input.maxUses ?? INVITE_DEFAULT_MAX_USES;
  const expiresAt =
    input.expiresAt ??
    new Date(Date.now() + INVITE_DEFAULT_EXPIRES_DAYS * 86400000).toISOString();
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) {
    throw new DataAccessError("max_uses must be 1-1000", "22023");
  }
  const token = globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID();
  const hash = await globalThis.crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(token))
    .then((b) => Buffer.from(b).toString("hex"));
  const { data, error } = await client
    .from("course_invite_tokens")
    .insert({
      university_id: input.universityId,
      offering_id: input.offeringId,
      token_hash: hash,
      status: "active",
      max_uses: maxUses,
      expires_at: expiresAt,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new DataAccessError("Could not create invite token", error?.code);
  }
  await recordServiceRoleAudit(client, {
    actorId,
    action: "course_invite_created",
    entityType: "course_invite_token",
    entityId: data.id,
    classId: null,
    universityId: input.universityId,
  });
  return { id: data.id, token };
}
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
