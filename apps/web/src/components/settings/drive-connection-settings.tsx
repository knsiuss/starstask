"use client";

import { FolderCheck, Loader2, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

type Props = {
  configured: boolean;
  connected: boolean;
  driveEmail: string | null;
  connectedAt: string | null;
};

export function DriveConnectionSettings({
  configured,
  connected,
  driveEmail,
  connectedAt,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const response = await fetch(
        "/api/integrations/google-drive/disconnect",
        { method: "POST" },
      );
      if (!response.ok) {
        setError("Could not disconnect Google Drive. Try again.");
        return;
      }
      setDialogOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Google Drive</h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
            Connect once, then submit assignments straight from your Drive.
            StarsTask only asks for permission to read files you pick — it never
            reads the rest of your Drive.
          </p>
        </div>
        <Badge variant={connected ? "success" : "neutral"}>
          {connected ? "Connected" : "Not connected"}
        </Badge>
      </div>

      {connected && driveEmail ? (
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Drive account
            </dt>
            <dd className="mt-0.5">{driveEmail}</dd>
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
            Google Drive is not configured on this deployment.
          </p>
          <p className="mt-1">
            Ask an administrator to add the Google Drive OAuth credentials.
          </p>
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
              <DialogTitle>Disconnect Google Drive?</DialogTitle>
              <DialogDescription>
                The stored permission is revoked and StarsTask removes the
                encrypted tokens. Submissions you already made stay as they are.
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
            <Link href="/api/integrations/google-drive/start">
              <FolderCheck
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              {connected ? "Reconnect" : "Connect Google Drive"}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
