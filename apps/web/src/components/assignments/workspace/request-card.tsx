import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  requestFeedback,
  REQUEST_STATUS_LABELS,
} from "@/lib/assignments/workspace";
import type { WorkspaceRequest } from "@/lib/db/assignment-workspace";

const STATUS_VARIANTS: Record<
  WorkspaceRequest["displayStatus"],
  "warning" | "success" | "danger"
> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  revision_requested: "warning",
};

type Props = {
  request: WorkspaceRequest;
  /** Admin queue renders the review action; student list renders feedback. */
  mode: "student" | "admin";
  reviewAction?: React.ReactNode;
};

/**
 * One publication request row. The student view shows their status and the
 * admin's feedback (with a revise path); the admin queue shows who submitted
 * it and, while it is pending, the review action.
 */
export function RequestCard({ request, mode, reviewAction }: Props) {
  const feedback = requestFeedback({
    status: request.status,
    rejection_reason: request.rejection_reason,
  });
  const submitted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(request.created_at));

  return (
    <li className="border-border bg-surface rounded-xl border p-3.5 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={STATUS_VARIANTS[request.displayStatus]}>
              {REQUEST_STATUS_LABELS[request.displayStatus]}
            </Badge>
            <span className="text-muted-foreground truncate">
              {request.course_name}
              {request.class_code ? ` · ${request.class_code}` : ""}
            </span>
            {mode === "admin" && request.submitter_name ? (
              <span className="text-muted-foreground">
                by {request.submitter_name}
              </span>
            ) : null}
          </div>

          <h3 className="text-foreground mt-2 text-[15px] leading-snug font-semibold tracking-tight break-words">
            {request.title}
          </h3>

          <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>{request.class_name}</span>
            <span className="inline-flex items-center gap-1">
              <Clock
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              {request.deadline
                ? `Proposed ${new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Asia/Jakarta",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(request.deadline))}`
                : "No deadline proposed"}
            </span>
            <span>Submitted {submitted}</span>
          </p>
        </div>

        {(mode === "admin" && request.displayStatus === "pending") ||
        request.displayStatus === "approved" ? (
          <div className="flex shrink-0 items-center gap-2">
            {mode === "admin" && request.displayStatus === "pending"
              ? reviewAction
              : null}
            {request.displayStatus === "approved" ? (
              <Link
                href={`/assignments/${request.id}`}
                className="text-accent hover:text-accent-hover inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors sm:min-h-[32px] sm:px-1"
              >
                View
                <ArrowRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {feedback ? (
        <div className="bg-band border-border/60 mt-3 rounded-lg border px-3.5 py-2.5 text-xs">
          <p className="text-muted-foreground font-medium">Admin feedback</p>
          <p className="text-foreground mt-0.5 leading-relaxed">{feedback}</p>
          {mode === "student" &&
          request.displayStatus === "revision_requested" ? (
            <Link
              href={`/app/classes/${request.class_slug}`}
              className="text-accent hover:text-accent-hover mt-1 inline-flex min-h-[44px] items-center gap-1 font-semibold sm:mt-1.5 sm:min-h-[28px]"
            >
              Revise in {request.class_name}
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
