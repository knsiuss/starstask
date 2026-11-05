"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type InviteRevokeButtonProps = {
  tokenId: string;
  disabled?: boolean;
};

/** Revokes an invite token (platform admin; usage policy unresolved). */
export function InviteRevokeButton({
  tokenId,
  disabled,
}: InviteRevokeButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onRevoke() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/course-invites/${tokenId}/revoke`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          payload?.error?.message ?? "Could not revoke the invite.",
        );
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRevoke}
        disabled={pending || disabled}
      >
        {pending ? "Revoking…" : "Revoke"}
      </Button>
      {error ? (
        <span className="text-danger mt-1 max-w-56 text-xs">{error}</span>
      ) : null}
    </span>
  );
}
