"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type MarkReadButtonProps = {
  classSlug: string;
  announcementId: string;
  read: boolean;
};

/** Marks a published announcement as read for the caller (idempotent). */
export function MarkReadButton({
  classSlug,
  announcementId,
  read,
}: MarkReadButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onMarkRead() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/academic/announcements/${announcementId}/read`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error("Could not mark as read.");
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  if (read) {
    return <span className="text-muted-foreground text-xs">Read</span>;
  }

  return (
    <span className="inline-flex flex-col items-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onMarkRead}
        disabled={pending}
      >
        {pending ? "Marking…" : "Mark as read"}
      </Button>
      {error ? <span className="text-danger text-xs">{error}</span> : null}
    </span>
  );
}
