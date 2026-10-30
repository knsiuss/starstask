import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/classes/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@starstask/shared";

import type { VerificationRequestView } from "@/lib/db/verification";

export function VerificationQueueList({
  items,
  filtered,
}: {
  items: VerificationRequestView[];
  filtered: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-lg border border-dashed px-5 py-8 text-center">
        <p className="text-sm font-medium">
          {filtered ? "No requests match these filters" : "No requests waiting"}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {filtered
            ? "Clear or change the filters to see the rest of the queue."
            : "Submitted class representative requests appear here for review."}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/verifications/${item.id}`}
                className="hover:text-accent font-medium underline-offset-4 hover:underline"
              >
                {item.studentName}
              </Link>
              <StatusBadge status={item.status} />
              {item.status === "verified" && item.hasClassAdminAccess ? (
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  <ShieldCheck
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Class admin active
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {item.className}
              {item.classSemester ? ` · ${item.classSemester}` : ""} ·{" "}
              {item.submittedAt
                ? `submitted ${formatDate(item.submittedAt)}`
                : "not submitted"}
              {item.revisionCount > 0
                ? ` · ${item.revisionCount} revision${item.revisionCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="text-muted-foreground text-xs">
              {item.evidenceCount} {item.evidenceCount === 1 ? "file" : "files"}
            </span>
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link href={`/admin/verifications/${item.id}`}>
                Review
                <ArrowRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
