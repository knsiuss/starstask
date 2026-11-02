"use client";

import { Archive, Loader2, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ClassLifecycleStatus } from "@starstask/contracts";

type ClassStatusControlProps = {
  classSlug: string;
  status: ClassLifecycleStatus;
  redirectTo: string;
};

const COPY: Record<ClassLifecycleStatus, string> = {
  draft:
    "Draft classes are visible only to class managers. Activating makes the class available to students.",
  active:
    "Archiving hides the class from discovery and stops new submissions. Members, assignments, submissions, attendance, and schedules are preserved.",
  archived:
    "Restoring makes the class active again. Its members, assignments, and history stay attached.",
};

/**
 * Activates, archives, or restores a class. Class managers may change the
 * lifecycle of their own class and platform admins may change any class; the
 * API and the database function re-check the role and the transition.
 */
export function ClassStatusControl({
  classSlug,
  status,
  redirectTo,
}: ClassStatusControlProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nextStatus: ClassLifecycleStatus =
    status === "archived"
      ? "active"
      : status === "draft"
        ? "active"
        : "archived";

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
        {COPY[status]}
      </p>
      <Button
        type="button"
        variant={status === "active" ? "secondary" : "primary"}
        size="sm"
        onClick={() => void apply()}
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin"
          />
        ) : status === "archived" ? (
          <RotateCcw
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        ) : status === "draft" ? (
          <Play
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        ) : (
          <Archive
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        )}
        {status === "archived"
          ? "Restore class"
          : status === "draft"
            ? "Activate class"
            : "Archive class"}
      </Button>
    </div>
  );
}
