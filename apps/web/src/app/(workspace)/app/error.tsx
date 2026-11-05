"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the digest only; error messages can contain internal details.
    console.error("[dashboard] load error", { digest: error.digest });
  }, [error.digest]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <CircleAlert
        aria-hidden="true"
        className="text-warning h-8 w-8"
      />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        Your dashboard could not be loaded
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This is usually temporary. Try again in a moment.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          onClick={reset}
        >
          Try again
        </Button>
        <Button
          asChild
          variant="secondary"
        >
          <Link href="/assignments">Explore assignments</Link>
        </Button>
      </div>
    </div>
  );
}
