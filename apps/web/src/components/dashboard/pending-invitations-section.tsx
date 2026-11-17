"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Check, Clock, Loader2, Mail, ShieldCheck, X } from "lucide-react";

import { formatDate } from "@starstask/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DashboardPendingInvitation } from "@/lib/db/dashboard";

type PendingInvitationsSectionProps = {
  initialInvitations: DashboardPendingInvitation[];
};

export function PendingInvitationsSection({
  initialInvitations,
}: PendingInvitationsSectionProps) {
  const router = useRouter();
  const [invitations, setInvitations] = React.useState(initialInvitations);
  const [busyIds, setBusyIds] = React.useState<ReadonlySet<string>>(new Set());
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Keep the list in step with the server after router.refresh() so new or
  // removed invitations appear without a manual reload.
  const [prevInitial, setPrevInitial] = React.useState(initialInvitations);

  if (initialInvitations !== prevInitial) {
    setPrevInitial(initialInvitations);
    setInvitations(initialInvitations);
  }

  // Omit the section when there are no pending invitations or feedback to keep the rail compact.
  if (invitations.length === 0 && !feedback) {
    return null;
  }

  const anyBusy = busyIds.size > 0;

  const handleAccept = async (invitation: DashboardPendingInvitation) => {
    setBusyIds(new Set([invitation.id]));
    setFeedback(null);

    try {
      const response = await fetch("/api/classes/invitations/accept-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: invitation.id }),
      });

      const body = (await response.json().catch(() => null)) as {
        data?: { slug: string | null; name: string | null };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: body?.error?.message ?? "Could not accept this invitation.",
        });
        return;
      }

      setInvitations((prev) =>
        prev.filter((item) => item.id !== invitation.id),
      );
      setFeedback({
        type: "success",
        message: `Joined ${invitation.class_name}. All its subjects are now available.`,
      });

      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      setBusyIds(new Set());
    }
  };

  const handleDecline = async (invitationId: string) => {
    setBusyIds(new Set([invitationId]));
    setFeedback(null);

    try {
      const response = await fetch("/api/classes/invitations/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: body?.error?.message ?? "Could not decline this invitation.",
        });
        return;
      }

      setInvitations((prev) => prev.filter((item) => item.id !== invitationId));
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      setBusyIds(new Set());
    }
  };

  return (
    <section aria-labelledby="pending-invitations-heading">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="pending-invitations-heading"
          className="text-foreground flex items-center gap-2 text-[15px] font-semibold tracking-tight"
        >
          <Mail
            aria-hidden="true"
            className="text-accent h-4 w-4 shrink-0"
          />
          <span>Pending invitations</span>
        </h2>

        {invitations.length > 0 ? (
          <span className="bg-accent-soft text-accent rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums">
            {invitations.length}
          </span>
        ) : null}
      </div>

      {feedback ? (
        <Alert
          variant={feedback.type}
          className="mt-2.5"
        >
          {feedback.message}
        </Alert>
      ) : null}

      {invitations.length > 0 ? (
        <ul className="mt-2.5 space-y-2.5">
          {invitations.map((invitation) => {
            const isBusy = busyIds.has(invitation.id);

            return (
              <li
                key={invitation.id}
                className="border-border bg-surface rounded-xl border p-3.5"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-semibold">
                    {invitation.class_name}
                  </p>
                  <span className="bg-muted text-muted-foreground mt-1 inline-block rounded-md px-1.5 py-0.5 font-mono text-[11px]">
                    {invitation.class_slug}
                  </span>
                </div>

                <div className="text-muted-foreground mt-2.5 space-y-1 text-xs">
                  <p className="flex min-w-0 items-center gap-1.5">
                    <ShieldCheck
                      aria-hidden="true"
                      className="text-accent h-3.5 w-3.5 shrink-0"
                    />
                    <span className="truncate">
                      Invited by {invitation.admin_name}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Clock
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span>Expires {formatDate(invitation.expires_at)}</span>
                  </p>
                </div>

                <div className="border-border/60 mt-3 flex items-center gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    onClick={() => void handleAccept(invitation)}
                    disabled={anyBusy}
                    className="min-h-10 flex-1 sm:min-h-9"
                  >
                    {isBusy ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-3.5 w-3.5 animate-spin"
                      />
                    ) : (
                      <Check
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    )}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleDecline(invitation.id)}
                    disabled={anyBusy}
                    className="min-h-10 sm:min-h-9"
                  >
                    <X
                      aria-hidden="true"
                      className="text-muted-foreground h-3.5 w-3.5"
                    />
                    Decline
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
