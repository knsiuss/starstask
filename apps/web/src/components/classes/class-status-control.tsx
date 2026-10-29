"use client";

import { Archive, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ClassStatusControlProps = {
  classSlug: string;
  status: "active" | "archived";
  redirectTo: string;
};

/**
 * Archives or restores a class. Only platform admins can do this; the page
 * renders it for them and the API re-checks the role.
 */
export function ClassStatusControl({
  classSlug,
  status,
  redirectTo,
}: ClassStatusControlProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nextStatus = status === "active" ? "archived" : "active";

  const apply = async () => {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not change the class status.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <p className="text-muted-foreground text-xs leading-relaxed">
        Archiving hides the class from public discovery and stops new
        submissions. Published assignments keep their current visibility unless
        they are moderated separately.
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void apply()}
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin"
          />
        ) : status === "active" ? (
          <Archive
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        ) : (
          <RotateCcw
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        )}
        {status === "active" ? "Archive class" : "Restore class"}
      </Button>
    </div>
  );
}
