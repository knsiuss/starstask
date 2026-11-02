import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Plain-text empty states. When the list is empty the only useful things are
 * the reason and the way out, so there is no card, icon tile, or shadow here.
 */
export function EmptyClassDirectory() {
  return (
    <div className="px-2 py-16 text-center">
      <p className="text-foreground text-sm font-medium">
        You haven&apos;t joined any classes yet
      </p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm leading-relaxed">
        Join a class with an invitation code to see its subjects, assignments,
        and members.
      </p>
      <Button
        asChild
        size="sm"
        className="mt-5"
      >
        <Link href="/classes/join">Join a class</Link>
      </Button>
    </div>
  );
}

/** Shown when filters exclude every class the caller belongs to. */
export function EmptyClassSearch() {
  return (
    <div className="px-2 py-16 text-center">
      <p className="text-foreground text-sm font-medium">
        No classes match your filters
      </p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm leading-relaxed">
        Try a different name, code, or semester.
      </p>
      <Link
        href="/classes"
        className="text-accent mt-4 inline-block text-sm underline-offset-4 hover:underline"
      >
        Reset search and filters
      </Link>
    </div>
  );
}
