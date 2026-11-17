import { SearchX } from "lucide-react";
import Link from "next/link";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import { Button } from "@/components/ui/button";
import type { AssignmentListItem } from "@/types/database";

type AssignmentListProps = {
  assignments: AssignmentListItem[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function AssignmentList({
  assignments,
  emptyTitle = "No assignments found",
  emptyDescription = "Try a different search, or be the first to contribute an assignment for this course.",
}: AssignmentListProps) {
  if (assignments.length === 0) {
    return (
      <div className="border-border bg-surface flex flex-col items-center rounded-xl border px-4 py-12 text-center sm:px-6 sm:py-16">
        <span className="bg-subtle border-border/60 flex h-12 w-12 items-center justify-center rounded-full border sm:h-14 sm:w-14">
          <SearchX
            aria-hidden="true"
            className="text-muted-foreground h-5 w-5 sm:h-6 sm:w-6"
          />
        </span>
        <h2 className="text-foreground mt-4 text-base font-semibold tracking-tight sm:mt-5 sm:text-lg">
          {emptyTitle}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          {emptyDescription}
        </p>
        <Button
          asChild
          className="mt-6 min-h-[44px] w-full sm:w-auto"
        >
          <Link href="/submit">Submit an assignment</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {assignments.map((assignment) => (
        <li
          key={assignment.id}
          className="h-full min-w-0"
        >
          <AssignmentCard assignment={assignment} />
        </li>
      ))}
    </ul>
  );
}
