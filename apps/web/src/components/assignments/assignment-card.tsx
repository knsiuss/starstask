import { ExternalLink, Paperclip } from "lucide-react";
import Link from "next/link";

import { isSafeHttpUrl } from "@starstask/contracts";
import { excerpt, formatDate, pluralize } from "@starstask/shared";

import { AssignmentContentTypeBadge } from "@/components/assignments/assignment-content-type-badge";
import { CompletionToggle } from "@/components/assignments/completion-toggle";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { Badge } from "@/components/ui/badge";
import type { AssignmentListItem } from "@/types/database";

type AssignmentCardProps = {
  assignment: AssignmentListItem;
};

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  const courseLabel = assignment.course_code
    ? `${assignment.course_code} · ${assignment.course_name}`
    : assignment.course_name;

  return (
    <article className="border-border bg-surface hover:border-accent/40 flex h-full min-w-0 flex-col rounded-xl border p-4 transition-colors sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge
          variant="neutral"
          className="max-w-full truncate"
        >
          {courseLabel}
        </Badge>
        <DeadlineBadge deadline={assignment.deadline} />
      </div>

      {assignment.content_type || assignment.semester ? (
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
          {assignment.content_type ? (
            <AssignmentContentTypeBadge
              contentType={assignment.content_type}
              sourceLabel={assignment.source_label}
            />
          ) : null}
          {assignment.semester ? <span>{assignment.semester}</span> : null}
        </div>
      ) : null}

      <h2 className="mt-3 text-base leading-snug font-semibold tracking-tight break-words sm:text-lg">
        <Link
          href={`/assignments/${assignment.id}`}
          className="hover:text-accent focus-visible:outline-accent line-clamp-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {assignment.title}
        </Link>
      </h2>

      <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed break-words">
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
                className="bg-muted text-muted-foreground hover:bg-accent-soft hover:text-accent focus-visible:outline-accent inline-flex min-h-[28px] items-center rounded-full px-2.5 py-0.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="border-border/60 text-muted-foreground mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
        <span className="min-w-0 truncate">
          {assignment.author_display_name} · {formatDate(assignment.created_at)}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {assignment.drive_url && isSafeHttpUrl(assignment.drive_url) ? (
            <a
              href={assignment.drive_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="hover:text-accent focus-visible:outline-accent -my-1.5 inline-flex min-h-[44px] items-center gap-1 rounded-sm px-1 focus-visible:outline-2 focus-visible:outline-offset-2 sm:my-0 sm:min-h-0 sm:px-0"
            >
              <ExternalLink
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Drive
            </a>
          ) : null}
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
          {typeof assignment.completed === "boolean" ? (
            <CompletionToggle
              assignmentId={assignment.id}
              completed={assignment.completed}
              title={assignment.title}
            />
          ) : null}
        </span>
      </div>
    </article>
  );
}
