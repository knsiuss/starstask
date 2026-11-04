"use client";

import { SlidersHorizontal } from "lucide-react";
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Filters below the lg breakpoint. The desktop sticky sidebar renders the
 * same content; here it lives in a bottom sheet so the board keeps the
 * full width on tablet and mobile.
 */
export function FilterDrawer({
  activeFilterCount,
  children,
}: {
  activeFilterCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="border-border bg-surface text-foreground hover:bg-subtle inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium"
      >
        <SlidersHorizontal
          aria-hidden="true"
          className="h-4 w-4"
        />
        Filters
        {activeFilterCount > 0 ? (
          <span className="bg-accent inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto rounded-t-3xl"
          aria-label="Calendar filters"
        >
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription>
            Refine the calendar to the courses and event types you need.
          </DialogDescription>
          <div className="mt-4 space-y-5">{children}</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="bg-accent hover:bg-accent-soft mt-4 w-full rounded-xl py-2.5 text-sm font-medium text-white"
          >
            Show Results
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
