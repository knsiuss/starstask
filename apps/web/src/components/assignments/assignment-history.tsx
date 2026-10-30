import { History } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { AssignmentRevision } from "@/lib/db/assignment-trust";
import { excerpt, formatDate, formatDeadline } from "@starstask/shared";

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  description: "description",
  deadline: "deadline",
  status: "status",
  course_id: "course",
  class_id: "class",
};

function describeChange(revision: AssignmentRevision): string {
  if (revision.changeKind === "created") {
    return "Published";
  }

  if (revision.changeKind === "moderated") {
    return "Status changed";
  }

  const fields = revision.changedFields
    .map((field) => FIELD_LABELS[field] ?? field)
    .filter(Boolean);

  return fields.length > 0 ? `Updated ${fields.join(", ")}` : "Updated";
}

/**
 * Shows what the field looked like before this revision.
 *
 * The older row's snapshot is the state before the change, so the pair reads as
 * "23:59 → 12:00" instead of a bare new value. Without an older row there is
 * nothing to compare, and the line stays hidden.
 */
function RevisionDiff({
  revision,
  previous,
}: {
  revision: AssignmentRevision;
  previous?: AssignmentRevision;
}) {
  if (!previous) {
    return null;
  }

  const previousDeadline = previous.snapshot.deadline;

  if (
    revision.changedFields.includes("deadline") &&
    revision.snapshot.deadline
  ) {
    return (
      <p className="text-muted-foreground mt-1">
        Deadline:{" "}
        {previousDeadline ? `${formatDeadline(previousDeadline)} → ` : ""}
        {formatDeadline(revision.snapshot.deadline)}
      </p>
    );
  }

  if (
    revision.changedFields.includes("title") &&
    previous.snapshot.title &&
    revision.snapshot.title &&
    previous.snapshot.title !== revision.snapshot.title
  ) {
    return (
      <p className="text-muted-foreground mt-1">
        Title: “{excerpt(previous.snapshot.title, 48)}” → “
        {excerpt(revision.snapshot.title, 48)}”
      </p>
    );
  }

  return null;
}

/**
 * Change log for one assignment.
 *
 * Only the author, class admins, and platform admins can read this; the query
 * returns an empty list for everyone else, and the section stays hidden.
 */
export function AssignmentHistory({
  revisions,
}: {
  revisions: AssignmentRevision[];
}) {
  if (revisions.length === 0) {
    return null;
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <History
          aria-hidden="true"
          className="h-4 w-4"
        />
        Revision history
      </h2>

      <ol className="mt-3 space-y-3">
        {revisions.map((revision, index) => (
          <li
            key={revision.id}
            className="border-border border-l-2 pl-3 text-xs"
          >
            <p className="text-foreground font-medium">
              {describeChange(revision)}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {formatDate(revision.createdAt)} · {revision.editorName}
            </p>
            <RevisionDiff
              revision={revision}
              previous={revisions[index + 1]}
            />
          </li>
        ))}
      </ol>

      <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
        Every change to the title, description, deadline, or status is recorded
        automatically.
      </p>
    </Card>
  );
}
