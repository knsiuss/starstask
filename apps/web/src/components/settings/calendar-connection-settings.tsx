"use client";

import { CalendarCheck2, Loader2, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@starstask/shared";

type CalendarConnectionSettingsProps = {
  configured: boolean;
  connected: boolean;
  calendarId: string | null;
  connectedAt: string | null;
  lastErrorCategory: string | null;
};

const ERROR_LABELS: Record<string, string> = {
  invalid_grant: "Google revoked the permission. Reconnect to keep syncing.",
  transient: "Google did not respond. Try again in a moment.",
  invalid_request: "Google rejected the request. Reconnect to try again.",
};

/**
 * Connect and disconnect controls.
 *
 * Connecting is a plain link to the server's OAuth start route, so it works
 * without JavaScript and never puts a token or client secret in the page.
 * Disconnecting revokes the grant and deletes the stored tokens; it does not
 * touch the StarsTask session, so the user stays signed in.
 */
export function CalendarConnectionSettings({
  configured,
  connected,
  calendarId,
  connectedAt,
  lastErrorCategory,
}: CalendarConnectionSettingsProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const disconnect = async () => {
    if (pending) {
      return;
    }

    setError(null);
    setMessage(null);
    setPending(true);

    try {
      const response = await fetch(
        "/api/integrations/google-calendar/disconnect",
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        setError("Could not disconnect Google Calendar. Try again.");
        return;
      }

      setDialogOpen(false);
      setMessage("Google Calendar is disconnected.");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Google Calendar</h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
            Connect once and each session you add is copied into your own
            calendar. StarsTask only asks for permission to manage events it
            created — it never reads the rest of your calendar.
          </p>
        </div>
        <Badge variant={connected ? "success" : "neutral"}>
          {connected ? "Connected" : "Not connected"}
        </Badge>
      </div>

      {connected && calendarId ? (
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Calendar
            </dt>
            <dd className="mt-0.5">{calendarId}</dd>
          </div>
          {connectedAt ? (
            <div>
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Connected since
              </dt>
              <dd className="mt-0.5">{formatDate(connectedAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {!configured ? (
        <Alert
          variant="info"
          className="mt-4"
        >
          <p className="font-medium">
            Google Calendar sync is not configured on this deployment.
          </p>
          <p className="mt-1">
            The &quot;Add to Google Calendar&quot; link still works everywhere —
            it opens Google with the session details filled in and needs no
            account connection.
          </p>
        </Alert>
      ) : null}

      {lastErrorCategory ? (
        <Alert
          variant="warning"
          className="mt-4"
        >
          {ERROR_LABELS[lastErrorCategory] ??
            "The last sync failed. Reconnect to try again."}
        </Alert>
      ) : null}

      {error ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          {message}
        </Alert>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {connected ? (
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
              >
                <Unplug
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Disconnect
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Disconnect Google Calendar?</DialogTitle>
              <DialogDescription>
                The stored permission is revoked and StarsTask stops updating
                events it created. Events already in your calendar stay there.
                You stay signed in to StarsTask.
              </DialogDescription>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() => void disconnect()}
                >
                  {pending ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin"
                    />
                  ) : null}
                  Disconnect
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}

        {configured ? (
          <Button
            asChild
            size="sm"
          >
            <Link href="/api/integrations/google-calendar/start">
              <CalendarCheck2
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              {connected ? "Reconnect" : "Connect Google Calendar"}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
