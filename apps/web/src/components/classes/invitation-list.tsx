"use client";

import { Loader2, Search, Trash2 } from "lucide-react";
import * as React from "react";

import { formatDate } from "@starstask/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  INVITATION_FILTERS,
  INVITATION_FILTER_LABELS,
  INVITATION_STATUS_LABELS,
  filterInvitations,
  getInvitationCounts,
  getUsagePercent,
  type InvitationFilter,
} from "@/lib/classes/invitation-filters";
import {
  getInvitationStatus,
  type InvitationStatus,
} from "@/lib/classes/invitation-status";
import { cn } from "@/lib/utils/cn";

export type InvitationListItem = {
  id: string;
  email_restriction: string | null;
  expires_at: string;
  max_uses: number;
  used_count: number;
  revoked_at: string | null;
  created_at: string;
};

const STATUS_PILL_STYLES: Record<InvitationStatus, string> = {
  active: "border-success/30 bg-success-soft text-success",
  expired: "border-border bg-muted text-muted-foreground",
  exhausted: "border-warning/30 bg-warning-soft text-warning",
  revoked: "border-border bg-subtle text-muted-foreground",
};

const STATUS_BAR_STYLES: Record<InvitationStatus, string> = {
  active: "bg-accent",
  expired: "bg-muted-foreground/40",
  exhausted: "bg-warning",
  revoked: "bg-muted-foreground/30",
};

type InvitationListProps = {
  invitations: InvitationListItem[];
  revokingId: string | null;
  onRevoke: (invitationId: string) => void;
};

export function InvitationList({
  invitations,
  revokingId,
  onRevoke,
}: InvitationListProps) {
  const [filter, setFilter] = React.useState<InvitationFilter>("all");
  const [query, setQuery] = React.useState("");

  const now = new Date();
  const counts = getInvitationCounts(invitations, now);
  const visible = filterInvitations(invitations, filter, query, now);

  if (invitations.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-xl border border-dashed px-5 py-10 text-center">
        <p className="text-sm font-medium">No invite links yet</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Create one above and share it with your class.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filter invitations"
          className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto overflow-y-hidden px-1 py-0.5"
        >
          {INVITATION_FILTERS.map((value) => {
            const isSelected = filter === value;

            return (
              <button
                key={value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setFilter(value)}
                className={cn(
                  "focus-visible:outline-accent shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                  isSelected
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {INVITATION_FILTER_LABELS[value]}
                <span
                  className={cn(
                    "ml-1.5 tabular-nums",
                    isSelected ? "text-accent/70" : "text-muted-foreground/70",
                  )}
                >
                  {counts[value]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-56">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search email"
            aria-label="Search invitations"
            className="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="border-border bg-subtle rounded-xl border border-dashed px-4 py-8 text-center">
          <p className="text-sm font-medium">No invitations match</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Try another filter or clear the search.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setFilter("all");
              setQuery("");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
          {visible.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              now={now}
              isRevoking={revokingId === invitation.id}
              onRevoke={onRevoke}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

type InvitationRowProps = {
  invitation: InvitationListItem;
  now: Date;
  isRevoking: boolean;
  onRevoke: (invitationId: string) => void;
};

function InvitationRow({
  invitation,
  now,
  isRevoking,
  onRevoke,
}: InvitationRowProps) {
  const status = getInvitationStatus(invitation, now);
  const percent = getUsagePercent(invitation.used_count, invitation.max_uses);
  const audience = invitation.email_restriction ?? "Anyone with the link";
  const expiryLabel =
    status === "revoked" && invitation.revoked_at
      ? `Revoked ${formatDate(invitation.revoked_at)}`
      : `${status === "expired" ? "Expired" : "Expires"} ${formatDate(invitation.expires_at)}`;

  return (
    <li className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{audience}</p>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
              STATUS_PILL_STYLES[status],
            )}
          >
            {INVITATION_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Created {formatDate(invitation.created_at)}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-foreground font-medium tabular-nums">
            {invitation.used_count} of {invitation.max_uses} used
          </span>
          <span className="text-muted-foreground tabular-nums">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Invitation uses"
          aria-valuemin={0}
          aria-valuemax={invitation.max_uses}
          aria-valuenow={invitation.used_count}
          className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              STATUS_BAR_STYLES[status],
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{expiryLabel}</p>
      </div>

      {status !== "revoked" ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isRevoking}
            onClick={() => onRevoke(invitation.id)}
            aria-label="Revoke invitation"
          >
            {isRevoking ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : (
              <Trash2
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            )}
            {isRevoking ? "Revoking…" : "Revoke"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
