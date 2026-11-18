"use client";

import { Check, Copy, QrCode } from "lucide-react";
import * as React from "react";

import { InviteQrCard } from "@/components/classes/invite-qr-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type InvitationLinkToastProps = {
  url: string;
  emailRestriction: string | null;
};

/**
 * The raw invitation token is returned only once, so the copy and QR code
 * affordances are part of the security story rather than a convenience.
 */
export function InvitationLinkToast({
  url,
  emailRestriction,
}: InvitationLinkToastProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const timer = resetTimer;

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);

      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }

      resetTimer.current = setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard access can be blocked; fall back to manual selection.
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <Input
        ref={inputRef}
        readOnly
        value={url}
        aria-label="Invitation link"
        className="bg-background h-9 text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px]">
          {emailRestriction
            ? `Only ${emailRestriction} can join. Save now; hidden once closed.`
            : "Anyone with the link can join. Save now; hidden once closed."}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            asChild
            size="sm"
            variant="secondary"
          >
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Join our class on StarsTask: ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setQrOpen(true)}
          >
            <QrCode
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            QR
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void copy()}
          >
            {copied ? (
              <Check
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            ) : (
              <Copy
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <Dialog
        open={qrOpen}
        onOpenChange={setQrOpen}
      >
        <DialogContent className="max-w-sm rounded-xl">
          <DialogTitle>Invitation QR code</DialogTitle>
          <DialogDescription>
            Scan to open the join confirmation prompt.
          </DialogDescription>
          <div className="mt-4">
            <InviteQrCard url={url} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
