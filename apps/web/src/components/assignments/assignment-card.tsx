import { Paperclip } from "lucide-react";
import Link from "next/link";

import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { Badge } from "@/components/ui/badge";
import type { AssignmentListItem } from "@/types/database";
import { excerpt, formatDate, pluralize } from "@starstask/shared";

type AssignmentCardProps = {
  assignment: AssignmentListItem;
};

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  const courseLabel = assignment.course_code
    ? `${assignment.course_code} · ${assignment.course_name}`
    : assignment.course_name;

  return (
    <article className="border-border bg-surface hover:border-accent/30 flex h-full flex-col rounded-xl border p-5 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="neutral">{courseLabel}</Badge>
          {assignment.semester ? <span>{assignment.semester}</span> : null}
        </div>
        <DeadlineBadge deadline={assignment.deadline} />
      </div>

      <h2 className="mt-3 text-lg leading-snug font-semibold tracking-tight">
        <Link
          href={`/assignments/${assignment.id}`}
          className="hover:text-accent focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {assignment.title}
        </Link>
      </h2>

      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {excerpt(assignment.description, 200)}
      </p>

      {assignment.tags.length > 0 ? (
        <ul
          className="mt-3 flex flex-wrap gap-1.5"
          aria-label="Tags"
        >
          {assignment.tags.slice(0, 4).map((tag) => (
            <li key={tag}>
              <Link
                href={`/assignments?tag=${encodeURIComponent(tag)}`}
                className="bg-muted text-muted-foreground hover:bg-accent-soft hover:text-accent rounded-full px-2 py-0.5 text-xs"
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="text-muted-foreground mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs">
        <span>
          {assignment.author_display_name} · {formatDate(assignment.created_at)}
        </span>
        {assignment.attachment_count > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            {assignment.attachment_count}{" "}
            {pluralize(assignment.attachment_count, "file")}
          </span>
        ) : null}
      </div>
    </article>
  );
}
