"use client";

import { Check, Link2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Copies a per-meeting check-in deep link.
 *
 * The link is not a public bypass: it lands on the signed-in check-in page,
 * and GPS, identity, radius, and window are still enforced server-side. It
 * only saves students from hunting through the dashboard.
 */
export function AttendanceShareLinkButton({
  sessionId,
  meetingNumber,
}: {
  sessionId: string;
  meetingNumber?: number;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/attendance/checkin/${sessionId}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ variant: "success", title: "Check-in link copied" });
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast({
        variant: "error",
        title: "Could not copy the link",
        description: "Copy it manually from the address bar.",
      });
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={() => void copy()}
      aria-label={
        meetingNumber
          ? `Copy check-in link for meeting ${meetingNumber}`
          : "Copy check-in link"
      }
    >
      {copied ? (
        <Check
          aria-hidden="true"
          className="h-4 w-4"
        />
      ) : (
        <Link2
          aria-hidden="true"
          className="h-4 w-4"
        />
      )}
      {copied ? "Copied" : "Copy check-in link"}
    </Button>
  );
}
