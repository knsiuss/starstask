"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the digest only; messages and query details can contain internals.
    console.error("[ui] admin route error", { digest: error.digest });
  }, [error.digest]);

  return (
    <div className="py-6">
      <Alert variant="error">
        <p className="font-medium">This admin view could not be loaded.</p>
        <p className="mt-1">
          The database may be unreachable or a migration may not be applied yet.
        </p>
      </Alert>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={reset}
        >
          <RefreshCw
            aria-hidden="true"
            className="h-4 w-4"
          />
          Try again
        </Button>
        <Button
          asChild
          variant="secondary"
        >
          <Link href="/admin">Back to overview</Link>
        </Button>
      </div>
    </div>
  );
}
