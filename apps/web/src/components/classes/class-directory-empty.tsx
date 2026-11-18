import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Plain-text empty states. When the list is empty the only useful things are
 * the reason and the way out, so there is no card, icon tile, or shadow here.
 */
export function EmptyClassDirectory({
  isLecturer = false,
}: {
  isLecturer?: boolean;
}) {
  return (
    <div className="px-2 py-16 text-center">
      <p className="text-foreground text-sm font-medium">
        {isLecturer
          ? "You do not teach any classes yet"
          : "You haven't joined any classes yet"}
      </p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
        {isLecturer
          ? "Create a new class, import your teaching schedule / KRS, or join an existing class with an invitation code."
          : "Join a class with an invitation code to see its subjects, assignments, and members."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {isLecturer ? (
          <>
            <Button
              asChild
              size="sm"
            >
              <Link href="/classes/create">Create class</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link href="/classes/create?tab=krs">Import KRS / Schedule</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link href="/classes/join">Join a class</Link>
            </Button>
          </>
        ) : (
          <Button
            asChild
            size="sm"
          >
            <Link href="/classes/join">Join a class</Link>
          </Button>
        )}
      </div>
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
