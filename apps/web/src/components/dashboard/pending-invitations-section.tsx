"use client";

import { Check, Clock, Loader2, Mail, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DashboardPendingInvitation } from "@/lib/db/dashboard";
import { formatDate } from "@starstask/shared";

type PendingInvitationsSectionProps = {
  initialInvitations: DashboardPendingInvitation[];
};

export function PendingInvitationsSection({
  initialInvitations,
}: PendingInvitationsSectionProps) {
  const router = useRouter();
  const [invitations, setInvitations] = React.useState(initialInvitations);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // If there are no pending invitations, omit the section to keep the dashboard clean.
  if (invitations.length === 0 && !feedback) {
    return null;
  }

  const handleAccept = async (invitation: DashboardPendingInvitation) => {
    setLoadingId(invitation.id);
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

      // Immediately remove from pending list
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      setFeedback({
        type: "success",
        message: `Joined ${invitation.class_name}! You now have access to all its subjects.`,
      });

      // Refresh server data to populate My Classes immediately
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setLoadingId(invitationId);
    setFeedback(null);

    try {
      const response = await fetch("/api/classes/invitations/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: "Could not decline this invitation.",
        });
        return;
      }

      // Immediately remove from pending list
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section
      aria-labelledby="pending-invitations-heading"
      className="mt-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2
            id="pending-invitations-heading"
            className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2"
          >
            <Mail
              aria-hidden="true"
              className="h-4 w-4 text-accent"
            />
            Pending invitations
            <span className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-xs font-semibold">
              {invitations.length}
            </span>
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            Invitations to join class groups. Accepting adds you to the group
            and all its subjects.
          </p>
        </div>
      </div>

      {feedback ? (
        <Alert
          variant={feedback.type}
          className="mt-3"
        >
          {feedback.message}
        </Alert>
      ) : null}

      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {invitations.map((invitation) => {
          const isBusy = loadingId === invitation.id;

          return (
            <li
              key={invitation.id}
              className="border-border bg-surface flex flex-col justify-between rounded-xl border p-4 shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-semibold">
                      {invitation.class_name}
                    </p>
                    <span className="bg-muted text-muted-foreground font-mono rounded px-1.5 py-0.5 text-[10px]">
                      {invitation.class_slug}
                    </span>
                  </div>
                </div>

                <div className="text-muted-foreground mt-3 space-y-1 text-xs">
                  <p className="flex items-center gap-1.5">
                    <ShieldCheck
                      aria-hidden="true"
                      className="text-accent h-3.5 w-3.5 shrink-0"
                    />
                    <span>Invited by {invitation.admin_name}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground/80">
                    <Clock
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span>Expires {formatDate(invitation.expires_at)}</span>
                  </p>
                </div>
              </div>

              <div className="border-border/60 mt-4 flex items-center gap-2 border-t pt-3">
                <Button
                  size="sm"
                  onClick={() => void handleAccept(invitation)}
                  disabled={isBusy}
                  className="flex-1"
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
                  disabled={isBusy}
                >
                  <X
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
                  Decline
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
