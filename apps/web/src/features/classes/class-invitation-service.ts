import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { ClassInvitationCreateInput } from "@starstask/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toClassApiError } from "@/features/classes/errors";

const TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CreatedInvitation = {
  id: string;
  /** Raw token, returned exactly once so the admin can copy the link. */
  token: string;
  expiresAt: string;
  maxUses: number;
  emailRestriction: string | null;
};

/**
 * Creates a 256-bit token from a CSPRNG.
 *
 * Only the SHA-256 digest is stored. The raw token exists in memory long
 * enough to build the invitation link and is never written to the database,
 * logs, or audit metadata.
 */
export function createInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function invitationExpiryFromDays(days: number, now = Date.now()): string {
  return new Date(now + days * DAY_MS).toISOString();
}

export async function createClassInvitation(
  classId: string,
  input: ClassInvitationCreateInput,
): Promise<CreatedInvitation> {
  const { token, tokenHash } = createInvitationToken();
  const expiresAt = invitationExpiryFromDays(input.expiresInDays);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("create_class_invitation", {
    p_class_id: classId,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
    p_max_uses: input.maxUses,
    p_email_restriction: input.email ?? null,
  });

  if (error || !data) {
    throw toClassApiError(error, "Could not create the invitation.");
  }

  return {
    id: data,
    token,
    expiresAt,
    maxUses: input.maxUses,
    emailRestriction: input.email ?? null,
  };
}

export async function revokeClassInvitation(
  invitationId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("revoke_class_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) {
    throw toClassApiError(error, "Could not revoke the invitation.");
  }
}

/**
 * Redeems an invitation for the signed-in user.
 *
 * Expiry, revocation, usage limits, class state, and the optional email
 * restriction are all verified inside the function against trusted Auth data.
 */
export async function acceptClassInvitation(
  token: string,
): Promise<{ classId: string }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("accept_class_invitation", {
    p_token: token,
  });

  if (error || !data) {
    throw toClassApiError(error, "Could not accept the invitation.");
  }

  return { classId: data };
}
