"use client";

import { Check, KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type AttendanceSyncCodeButtonProps = {
  classSlug: string;
  sessionId: string;
  meetingNumber?: number;
};

/**
 * Requests a 15-minute sync code for the meeting and copies it to the
 * clipboard so a lecturer can paste it into the SIAKAD browser extension.
 */
export function AttendanceSyncCodeButton({
  classSlug,
  sessionId,
  meetingNumber,
}: AttendanceSyncCodeButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const generateAndCopy = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/attendance/meetings/${sessionId}/sync-code`,
        { method: "POST" },
      );

      const payload = (await response.json().catch(() => null)) as {
        data?: { code?: string };
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.data?.code) {
        toast({
          variant: "error",
          title: payload?.error?.message ?? "Could not generate a sync code.",
        });
        return;
      }

      await navigator.clipboard.writeText(payload.data.code);
      setCopied(true);
      toast({
        variant: "success",
        title: "Sync code copied",
        description:
          "Valid for 15 minutes. Paste it into the StarsTask SIAKAD extension.",
      });
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast({
        variant: "error",
        title: "Could not copy the sync code",
        description: "Please try again or check clipboard permissions.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => void generateAndCopy()}
        disabled={isLoading}
        aria-busy={isLoading}
        aria-label={
          meetingNumber
            ? `Copy SIAKAD sync code for meeting ${meetingNumber}`
            : "Copy SIAKAD sync code"
        }
      >
        {isLoading ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : copied ? (
          <Check
            aria-hidden="true"
            className="h-4 w-4"
          />
        ) : (
          <KeyRound
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}
        {copied ? "Sync code copied" : "Copy sync code"}
      </Button>
      <Link
        href="/download#extension"
        className="text-muted-foreground hover:text-accent text-xs underline underline-offset-2"
      >
        Get extension
      </Link>
    </div>
  );
}
