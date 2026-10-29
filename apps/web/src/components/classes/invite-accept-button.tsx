"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type InviteAcceptButtonProps = {
  token: string;
};

/**
 * Redeems an invitation from the signed-in user's browser.
 *
 * The token is sent once in the request body and never stored. Acceptance
 * grants membership only; admin roles stay with the platform admin.
 */
export function InviteAcceptButton({ token }: InviteAcceptButtonProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const accept = async () => {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/classes/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const body = (await response.json().catch(() => null)) as {
        data?: { slug: string | null };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not accept this invitation.");
        return;
      }

      const slug = body?.data?.slug;

      router.push(slug ? `/dashboard/classes/${slug}` : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button
        type="button"
        onClick={() => void accept()}
        disabled={isBusy}
        aria-busy={isBusy}
      >
        {isBusy ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : null}
        Join class
      </Button>
    </div>
  );
}
