"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DeveloperError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Alert variant="error">
        <p className="font-medium">Monitoring could not be loaded</p>
        <p className="mt-1 text-sm">
          The dashboard failed before it could render. No estimated or cached
          values are shown.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={reset}
        >
          Try again
        </Button>
      </Alert>
    </div>
  );
}
