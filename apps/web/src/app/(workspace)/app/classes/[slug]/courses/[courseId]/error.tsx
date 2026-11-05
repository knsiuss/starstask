"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function CourseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the real error in the console so a failure is diagnosable instead of
    // being replaced by a friendly message with no trace.
    console.error("[course] load error", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <CircleAlert
        aria-hidden="true"
        className="text-warning h-8 w-8"
      />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        This course could not be loaded
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        The data request failed, so the page was not rendered. Try again; if it
        keeps failing, the error is logged in the browser console.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground mt-2 font-mono text-xs">
          Reference: {error.digest}
        </p>
      ) : null}
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
          <Link href="/classes">My classes</Link>
        </Button>
      </div>
    </div>
  );
}
