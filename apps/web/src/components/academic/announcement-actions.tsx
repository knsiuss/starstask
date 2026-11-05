"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type AnnouncementActionsProps = {
  classSlug: string;
  announcementId: string;
  pinned: boolean;
  isDraft: boolean;
  isArchived: boolean;
};

/**
 * Row-level manager actions for an announcement: pin/unpin, publish draft,
 * or archive. Each action is a PATCH and the page re-renders from the server.
 */
export function AnnouncementActions({
  classSlug,
  announcementId,
  pinned,
  isDraft,
  isArchived,
}: AnnouncementActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function patch(body: Record<string, boolean>, label: string) {
    setPending(label);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/academic/announcements/${announcementId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          payload?.error?.message ?? "Could not update the announcement.",
        );
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isDraft ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending !== null}
          onClick={() => patch({ publish: true }, "publish")}
        >
          Publish
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending !== null}
        onClick={() => patch({ pinned: !pinned }, "pin")}
      >
        {pinned ? "Unpin" : "Pin"}
      </Button>
      {!isArchived ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending !== null}
          onClick={() => patch({ archive: true }, "archive")}
        >
          Archive
        </Button>
      ) : null}
      {error ? <p className="text-danger w-full text-xs">{error}</p> : null}
    </div>
  );
}
