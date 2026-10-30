"use client";

import { CalendarCheck2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type CalendarSyncButtonProps = {
  sessionId: string;
};

type SyncResponse = {
  data?: { status?: "synced" | "removed" };
  error?: { message?: string };
};

/**
 * Copies one session into the user's connected Google Calendar.
 *
 * The request carries no event id or calendar id: the server resolves both from
 * the caller's own connection and the session, so a forged body cannot write to
 * another calendar. Repeat clicks are safe because the server upserts one
 * mapping row per user and session.
 */
export function CalendarSyncButton({ sessionId }: CalendarSyncButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const sync = async () => {
    if (pending) {
      return;
    }

    setError(null);
    setMessage(null);
    setPending(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/calendar-sync`, {
        method: "POST",
      });
      const body = (await response
        .json()
        .catch(() => null)) as SyncResponse | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not reach Google Calendar.");
        return;
      }

      setMessage(
        body?.data?.status === "removed"
          ? "Removed from your Google Calendar."
          : "Added to your Google Calendar.",
      );
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => void sync()}
      >
        {pending ? (
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin"
          />
        ) : (
          <CalendarCheck2
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        )}
        Add to my Google Calendar
      </Button>

      {message ? (
        <Alert
          variant="success"
          className="mt-2"
        >
          {message}
        </Alert>
      ) : null}

      {error ? (
        <Alert
          variant="error"
          className="mt-2"
        >
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
