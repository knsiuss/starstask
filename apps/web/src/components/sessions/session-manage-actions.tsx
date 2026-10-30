"use client";

import { Ban, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { SessionStatus } from "@starstask/contracts";

type SessionManageActionsProps = {
  sessionId: string;
  classSlug: string;
  status: SessionStatus;
  canManage: boolean;
};

/**
 * Organiser controls.
 *
 * Cancelling asks for confirmation because it notifies every participant and
 * removes the calendar event. Each action re-checks permissions server-side.
 */
export function SessionManageActions({
  sessionId,
  classSlug,
  status,
  canManage,
}: SessionManageActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  if (!canManage) {
    return null;
  }

  const change = async (next: SessionStatus) => {
    if (pending) {
      return;
    }

    setError(null);
    setPending(next);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(
          body?.error?.message ?? "Could not change the session status.",
        );
        return;
      }

      setDialogOpen(false);
      toast({
        variant: "success",
        title:
          next === "cancelled"
            ? "Session cancelled"
            : next === "completed"
              ? "Session marked complete"
              : "Session reopened",
      });
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="border-border bg-subtle rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Organiser actions</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            You manage this class, so you can edit, cancel, or complete this
            session.
          </p>
        </div>
        <Button
          asChild
          variant="secondary"
          size="sm"
        >
          <Link href={`/sessions/${sessionId}/edit`}>Edit session</Link>
        </Button>
      </div>

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {status === "scheduled" ? (
          <>
            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending !== null}
                >
                  <Ban
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  Cancel session
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Cancel this session?</DialogTitle>
                <DialogDescription>
                  Everyone who answered going or maybe is notified, pending
                  reminders are dropped, and any calendar event StarsTask
                  created is removed on the next sync.
                </DialogDescription>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialogOpen(false)}
                  >
                    Keep it
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={pending !== null}
                    onClick={() => void change("cancelled")}
                  >
                    {pending === "cancelled" ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : null}
                    Yes, cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="secondary"
              size="sm"
              disabled={pending !== null}
              onClick={() => void change("completed")}
            >
              {pending === "completed" ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <CheckCircle2
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              )}
              Mark completed
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending !== null}
            onClick={() => void change("scheduled")}
          >
            {pending === "scheduled" ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <RotateCcw
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}
            Reopen session
          </Button>
        )}

        <Button
          asChild
          variant="ghost"
          size="sm"
        >
          <Link href={`/dashboard/classes/${classSlug}/sessions`}>
            All sessions in this class
          </Link>
        </Button>
      </div>
    </div>
  );
}
