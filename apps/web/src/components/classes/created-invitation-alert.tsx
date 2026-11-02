"use client";

import { Copy } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CreatedInvitationAlertProps = {
  invitePath: string;
  emailRestriction: string | null;
  copied: boolean;
  onCopy: () => void;
};

/**
 * The only place the raw invitation token exists. It is shown once and is never
 * recoverable, so the copy affordance is part of the security story.
 */
export function CreatedInvitationAlert({
  invitePath,
  emailRestriction,
  copied,
  onCopy,
}: CreatedInvitationAlertProps) {
  return (
    <Alert variant="success">
      <p className="font-medium">Invitation created</p>
      <p className="mt-1 text-xs">
        Copy this link now. For security it is shown only once and cannot be
        recovered later.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          readOnly
          value={invitePath}
          aria-label="Invitation link"
          className="max-w-md bg-background"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onCopy}
        >
          <Copy
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {emailRestriction ? (
        <p className="mt-2 text-xs">
          Only {emailRestriction} can accept this link.
        </p>
      ) : null}
    </Alert>
  );
}
