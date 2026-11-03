"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InvitationLinkToastProps = {
  url: string;
  emailRestriction: string | null;
};

/**
 * The raw invitation token is returned only once, so the copy affordance is
 * part of the security story rather than a convenience.
 */
export function InvitationLinkToast({
  url,
  emailRestriction,
}: InvitationLinkToastProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [copied, setCopied] = React.useState(false);
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

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px]">
          {emailRestriction
            ? `Only ${emailRestriction} can join.`
            : "Anyone with the link can join."}
        </span>
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
  );
}
