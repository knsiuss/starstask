import { GraduationCap, PlusCircle, SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Shown when the caller has no memberships at all. */
export function EmptyClassDirectory() {
  return (
    <div className="border-border bg-subtle rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="bg-surface border-border text-muted-foreground mx-auto flex h-10 w-10 items-center justify-center rounded-md border">
        <GraduationCap
          aria-hidden="true"
          className="h-4 w-4"
        />
      </span>
      <h2 className="mt-4 text-base font-semibold">
        You haven&apos;t joined any classes yet
      </h2>
      <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm leading-relaxed">
        Join a class using an invitation code to access its assignments and
        materials.
      </p>
      <Button
        asChild
        className="mt-5"
      >
        <Link href="/classes/join">
          <PlusCircle
            aria-hidden="true"
            className="h-4 w-4"
          />
          Join a class
        </Link>
      </Button>
    </div>
  );
}

/** Shown when filters exclude every class the caller belongs to. */
export function EmptyClassSearch() {
  return (
    <div className="border-border bg-subtle rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="bg-surface border-border text-muted-foreground mx-auto flex h-10 w-10 items-center justify-center rounded-md border">
        <SearchX
          aria-hidden="true"
          className="h-4 w-4"
        />
      </span>
      <h2 className="mt-4 text-base font-semibold">No classes found</h2>
      <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm leading-relaxed">
        Try a different search or adjust your filters.
      </p>
      <Button
        asChild
        variant="secondary"
        className="mt-5"
      >
        <Link href="/classes">Reset search and filters</Link>
      </Button>
    </div>
  );
}
