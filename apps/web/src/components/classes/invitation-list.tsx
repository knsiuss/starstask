"use client";

import { Trash2 } from "lucide-react";

import { formatDate } from "@starstask/shared";

import { Button } from "@/components/ui/button";
import {
  getInvitationStatus,
  type InvitationStatus,
} from "@/lib/classes/invitation-status";

export type InvitationListItem = {
  id: string;
  email_restriction: string | null;
  expires_at: string;
  max_uses: number;
  used_count: number;
  revoked_at: string | null;
  created_at: string;
};

const GROUP_ORDER: readonly InvitationStatus[] = [
  "active",
  "expired",
  "exhausted",
  "revoked",
];

const GROUP_LABELS: Record<InvitationStatus, string> = {
  active: "Active",
  expired: "Expired",
  exhausted: "Used up",
  revoked: "Revoked",
};

type InvitationListProps = {
  invitations: InvitationListItem[];
  onRevoke: (invitationId: string) => void;
};

export function InvitationList({ invitations, onRevoke }: InvitationListProps) {
  if (invitations.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-xl border border-dashed px-5 py-10 text-center">
        <p className="text-sm font-medium">No invitation links yet</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Create one and share it with your class.
        </p>
      </div>
    );
  }

  const groups = GROUP_ORDER.map((status) => ({
    status,
    items: invitations.filter(
      (invitation) => getInvitationStatus(invitation) === status,
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.status}>
          <div className="flex items-center gap-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {GROUP_LABELS[group.status]}
            </h3>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
              {group.items.length}
            </span>
          </div>

          <ul className="divide-border border-border mt-2 divide-y rounded-xl border">
            {group.items.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {invitation.email_restriction ?? "Anyone with the link"}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {invitation.used_count}/{invitation.max_uses} used · expires{" "}
                    {formatDate(invitation.expires_at)}
                  </p>
                </div>

                {group.status !== "revoked" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onRevoke(invitation.id)}
                    aria-label="Revoke invitation"
                  >
                    <Trash2
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
