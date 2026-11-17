"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type AssignmentFormActionsProps = {
  isSubmitting: boolean;
  submitLabel: string;
  footnote?: string;
  onCancel: () => void;
};

export function AssignmentFormActions({
  isSubmitting,
  submitLabel,
  footnote,
  onCancel,
}: AssignmentFormActionsProps) {
  return (
    <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[44px] w-full sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
          className="min-h-[44px] w-full sm:w-auto"
        >
          Cancel
        </Button>
      </div>

      {footnote ? (
        <p className="text-muted-foreground text-xs leading-relaxed sm:max-w-sm sm:text-right">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
