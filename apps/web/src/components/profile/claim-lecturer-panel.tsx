"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Surface for the auto-activated lecturer persona on the profile settings page.
 *
 * Activation happens inside the database at signup and at email confirmation,
 * never from this component. This panel only shows status and re-runs the
 * idempotent RPC as "re-check" for accounts whose email was confirmed before
 * the domain was registered — the client cannot enable anything itself.
 */
export function LecturerStatusPanel({
  emailDomain,
  isLecturer,
}: {
  /** Sign-in email domain shown read-only. */
  emailDomain: string | null;
  isLecturer: boolean;
}) {
  const router = useRouter();
  const [isChecking, setIsChecking] = React.useState(false);
  const [claimMessage, setClaimMessage] = React.useState<string | null>(null);

  if (isLecturer) {
    return (
      <p className="text-muted-foreground text-sm">
        Lecturer access is active for this account. Manage your classes from{" "}
        <a
          href="/app/lecturer"
          className="text-accent underline underline-offset-4"
        >
          Lecturer dashboard
        </a>
        .
      </p>
    );
  }

  const recheck = async () => {
    if (isChecking) {
      return;
    }

    setIsChecking(true);
    setClaimMessage(null);

    try {
      const response = await fetch("/api/profile/claim-lecturer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setClaimMessage(
          body?.error?.message ??
            "Your email is not registered as institutional for any active university yet.",
        );
        return;
      }

      router.refresh();
    } catch {
      setClaimMessage("Network error. Check your connection and try again.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-3">
      {claimMessage ? (
        <Alert variant="info">{claimMessage}</Alert>
      ) : (
        <p className="text-muted-foreground text-sm">
          Lecturer access activates automatically when your sign-in email domain{" "}
          <span className="font-medium text-foreground">
            {emailDomain ? `@${emailDomain}` : "on this account"}
          </span>{" "}
          matches a registered institutional domain. No NIDN or approval is
          collected, and a platform admin or your university&apos;s admin can
          revoke it.
        </p>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void recheck()}
        disabled={isChecking}
        aria-busy={isChecking}
      >
        {isChecking ? "Checking..." : "Re-check eligibility"}
      </Button>
    </div>
  );
}
