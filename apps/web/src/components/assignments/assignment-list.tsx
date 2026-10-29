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
      <div className="border-border bg-surface flex flex-col items-center rounded-xl border px-6 py-16 text-center">
        <span className="bg-subtle flex h-14 w-14 items-center justify-center rounded-full">
          <SearchX
            aria-hidden="true"
            className="text-muted-foreground h-6 w-6"
          />
        </span>
        <h2 className="mt-5 text-lg font-semibold tracking-tight">
          {emptyTitle}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          {emptyDescription}
        </p>
        <Button
          asChild
          className="mt-6"
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
          className="h-full"
        >
          <AssignmentCard assignment={assignment} />
        </li>
      ))}
    </ul>
  );
}
