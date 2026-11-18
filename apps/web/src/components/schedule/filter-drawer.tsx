"use client";

import { SlidersHorizontal } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Filters below the lg breakpoint. The desktop sticky sidebar renders the
 * same content; here it lives in a dialog so the board keeps the full width
 * on tablet and mobile.
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
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="min-h-11 px-3.5 sm:min-h-0 sm:px-3"
      >
        <SlidersHorizontal
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
        Filters
        {activeFilterCount > 0 ? (
          <span className="bg-accent text-accent-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {activeFilterCount}
          </span>
        ) : null}
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto rounded-xl"
          aria-label="Calendar filters"
        >
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription>
            Refine the calendar to the courses and event types you need.
          </DialogDescription>
          <div className="mt-4 space-y-5">{children}</div>
          <Button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-5 w-full"
          >
            Show Results
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
