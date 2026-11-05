import { ArrowRight } from "lucide-react";
import { Clock } from "lucide-react";
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
    <li className="border-border bg-surface rounded-xl border px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={STATUS_VARIANTS[request.displayStatus]}>
              {REQUEST_STATUS_LABELS[request.displayStatus]}
            </Badge>
            <span className="text-muted-foreground">
              {request.course_name}
              {request.class_code ? ` · ${request.class_code}` : ""}
            </span>
            {mode === "admin" && request.submitter_name ? (
              <span className="text-muted-foreground">
                by {request.submitter_name}
              </span>
            ) : null}
          </div>
          <h3 className="text-foreground mt-1.5 text-[15px] font-semibold tracking-tight">
            {request.title}
          </h3>
          <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span>{request.class_name}</span>
            <span className="inline-flex items-center gap-1">
              <Clock
                aria-hidden="true"
                className="h-3 w-3"
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
        <div className="flex shrink-0 items-center gap-2">
          {mode === "admin" && request.displayStatus === "pending"
            ? reviewAction
            : null}
          {request.displayStatus === "approved" ? (
            <Link
              href={`/assignments/${request.id}`}
              className="text-accent hover:text-accent-hover inline-flex items-center gap-1 rounded-md text-xs font-semibold transition-colors"
            >
              View
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </Link>
          ) : null}
        </div>
      </div>

      {feedback ? (
        <div className="bg-band mt-3 rounded-lg px-3 py-2.5 text-xs">
          <p className="text-muted-foreground font-medium">Admin feedback</p>
          <p className="text-foreground mt-0.5 leading-relaxed">{feedback}</p>
          {mode === "student" &&
          request.displayStatus === "revision_requested" ? (
            <Link
              href={`/app/classes/${request.class_slug}`}
              className="text-accent hover:text-accent-hover mt-1.5 inline-flex items-center gap-1 font-semibold"
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
