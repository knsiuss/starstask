"use client";

import { ChevronDown, ShieldCheck } from "lucide-react";
import * as React from "react";

import {
  RepresentativeGrantForm,
  type GrantableClass,
} from "@/components/verification/representative-grant-form";
import { Button } from "@/components/ui/button";

/**
 * The claim form stays closed until the owner asks for it.
 *
 * The page already shows the access they hold and every request they have
 * filed; a permanently visible form was the loudest block on the page for the
 * least frequent action.
 */
export function ClassAdminApplyPanel({
  classes,
}: {
  classes: GrantableClass[];
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  if (classes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Join an active class to claim representative access.
      </p>
    );
  }

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <ShieldCheck
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
        Apply for Class Admin access
        <ChevronDown
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
      </Button>
    );
  }

  return (
    <div className="border-border bg-subtle rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Claim a class</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Access is granted immediately. Up to 5 representatives per class.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
        >
          Close
        </Button>
      </div>

      <div className="mt-3">
        <RepresentativeGrantForm classes={classes} />
      </div>
    </div>
  );
}
