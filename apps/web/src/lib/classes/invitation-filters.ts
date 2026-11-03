import {
  getInvitationStatus,
  type InvitationStatus,
  type InvitationStatusInput,
} from "@/lib/classes/invitation-status";

export const INVITATION_FILTERS = [
  "all",
  "active",
  "expired",
  "exhausted",
  "revoked",
] as const;

export type InvitationFilter = (typeof INVITATION_FILTERS)[number];

export const INVITATION_FILTER_LABELS: Record<InvitationFilter, string> = {
  all: "All",
  active: "Active",
  expired: "Expired",
  exhausted: "Used up",
  revoked: "Revoked",
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  active: "Active",
  expired: "Expired",
  exhausted: "Used up",
  revoked: "Revoked",
};

type SearchableInvitation = InvitationStatusInput & {
  email_restriction: string | null;
};

export function getInvitationCounts<T extends InvitationStatusInput>(
  invitations: readonly T[],
  now: Date = new Date(),
): Record<InvitationFilter, number> {
  const counts: Record<InvitationFilter, number> = {
    all: invitations.length,
    active: 0,
    expired: 0,
    exhausted: 0,
    revoked: 0,
  };

  for (const invitation of invitations) {
    counts[getInvitationStatus(invitation, now)] += 1;
  }

  return counts;
}

export function filterInvitations<T extends SearchableInvitation>(
  invitations: readonly T[],
  filter: InvitationFilter,
  query: string,
  now: Date = new Date(),
): T[] {
  const needle = query.trim().toLowerCase();

  return invitations.filter((invitation) => {
    if (filter !== "all" && getInvitationStatus(invitation, now) !== filter) {
      return false;
    }

    if (needle.length === 0) {
      return true;
    }

    const label = (
      invitation.email_restriction ?? "anyone with the link"
    ).toLowerCase();

    return label.includes(needle);
  });
}

export function getUsagePercent(usedCount: number, maxUses: number): number {
  if (!Number.isFinite(maxUses) || maxUses <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((usedCount / maxUses) * 100)));
}
