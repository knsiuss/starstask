"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type RevokeAdminButtonProps = {
  classSlug: string;
  assignmentId: string;
  disabled?: boolean;
};

/**
 * Revokes an admin assignment. The server enforces `manage_admins` and the
 * database last-admin guard; a 409 surfaces as an inline message.
 */
export function RevokeAdminButton({
  classSlug,
  assignmentId,
  disabled,
}: RevokeAdminButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onRevoke() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/academic/admins/${assignmentId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "Could not revoke the admin role.",
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
    <div className="inline-flex flex-col items-end">
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
        <p className="text-danger mt-1 max-w-56 text-xs">{error}</p>
      ) : null}
    </div>
  );
}
