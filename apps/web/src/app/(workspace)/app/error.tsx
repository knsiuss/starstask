"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
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
    <PageShell width="canvas">
      <div
        role="alert"
        className="border-border bg-surface mx-auto my-8 flex max-w-lg flex-col items-center rounded-xl border px-6 py-10 text-center sm:my-14 sm:px-8"
      >
        <span
          aria-hidden="true"
          className="bg-warning-soft text-warning flex h-11 w-11 items-center justify-center rounded-lg"
        >
          <CircleAlert className="h-5 w-5" />
        </span>

        <h1 className="text-foreground mt-4 text-lg font-semibold tracking-tight">
          Unable to load dashboard
        </h1>

        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
          This is usually temporary. Try again in a moment, or open your
          assignments directly.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Button
            type="button"
            onClick={reset}
          >
            <RotateCcw
              aria-hidden="true"
              className="h-4 w-4"
            />
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
    </PageShell>
  );
}
