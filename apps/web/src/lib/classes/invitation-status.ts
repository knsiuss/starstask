/**
 * Invitation validity is defined in one place so the database count and the
 * invitation manager can never disagree. `class_invitations` stores
 * `max_uses` as a bounded integer (1–500), so there is no unlimited-use case.
 */

export type InvitationStatusInput = {
  expires_at: string;
  max_uses: number;
  used_count: number;
  revoked_at: string | null;
};

export type InvitationStatus = "active" | "revoked" | "expired" | "exhausted";

export function getInvitationStatus(
  invitation: InvitationStatusInput,
  now: Date = new Date(),
): InvitationStatus {
  if (invitation.revoked_at !== null) {
    return "revoked";
  }

  const expiresAt = new Date(invitation.expires_at);

  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
    return "expired";
  }

  if (invitation.used_count >= invitation.max_uses) {
    return "exhausted";
  }

  return "active";
}

export function isInvitationActive(
  invitation: InvitationStatusInput,
  now: Date = new Date(),
): boolean {
  return getInvitationStatus(invitation, now) === "active";
}
