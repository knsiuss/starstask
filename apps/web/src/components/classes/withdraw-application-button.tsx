"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";

type WithdrawApplicationButtonProps = {
  applicationId: string;
};

/** Withdraws a pending application. Decided applications cannot be withdrawn. */
export function WithdrawApplicationButton({
  applicationId,
}: WithdrawApplicationButtonProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const withdraw = async () => {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/applications/${applicationId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not withdraw the application.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void withdraw()}
        disabled={isBusy}
        aria-busy={isBusy}
      >
        {isBusy ? (
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin"
          />
        ) : null}
        Withdraw
      </Button>
      {error ? <p className="text-danger mt-1 text-xs">{error}</p> : null}
    </div>
  );
}
