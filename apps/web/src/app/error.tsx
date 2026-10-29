"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the digest only; error messages can contain internal details.
    console.error("[ui] route error", { digest: error.digest });
  }, [error.digest]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <AlertTriangle
        aria-hidden="true"
        className="text-warning h-10 w-10"
      />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        The page could not be loaded. This is usually temporary.
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
          <Link href="/assignments">Back to assignments</Link>
        </Button>
      </div>
    </div>
  );
}
