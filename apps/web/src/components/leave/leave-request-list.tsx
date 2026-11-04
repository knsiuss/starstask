import Link from "next/link";
import { CalendarDays, PlusCircle } from "lucide-react";

import { LeaveRequestCard } from "@/components/leave/leave-request-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { LeaveRequestSummary } from "@/lib/db/leave";

/**
 * List wrapper with explicit empty and "nothing matches" states.
 *
 * The two are different situations: a student with no requests needs a way to
 * start one, while a filtered list that came back empty needs a way to reset.
 */
export function LeaveRequestList({
  requests,
  hrefFor,
  showStudent = false,
  emptyTitle,
  emptyBody,
  filtered = false,
  newHref,
}: {
  requests: LeaveRequestSummary[];
  hrefFor: (request: LeaveRequestSummary) => string;
  showStudent?: boolean;
  emptyTitle: string;
  emptyBody: string;
  filtered?: boolean;
  newHref?: string;
}) {
  if (requests.length === 0) {
    return (
      <Card className="px-6 py-16 text-center">
        {filtered ? null : (
          <span
            aria-hidden="true"
            className="text-muted-foreground mx-auto flex h-12 w-12 items-center justify-center"
          >
            <CalendarDays className="h-10 w-10" />
          </span>
        )}
        <p className="mt-4 text-base font-semibold">
          {filtered ? "No requests match these filters" : emptyTitle}
        </p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
          {filtered
            ? "Try a wider date range or a different status."
            : emptyBody}
        </p>
        {newHref ? (
          <Button
            asChild
            className="mt-5"
          >
            <Link href={newHref}>
              <PlusCircle
                aria-hidden="true"
                className="h-4 w-4"
              />
              New Request
            </Link>
          </Button>
        ) : null}
      </Card>
    );
  }

  return (
    <ul className="grid gap-3">
      {requests.map((request) => (
        <li key={request.id}>
          <LeaveRequestCard
            request={request}
            href={hrefFor(request)}
            showStudent={showStudent}
          />
        </li>
      ))}
    </ul>
  );
}
