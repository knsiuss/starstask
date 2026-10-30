import { LeaveRequestCard } from "@/components/leave/leave-request-card";
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
}: {
  requests: LeaveRequestSummary[];
  hrefFor: (request: LeaveRequestSummary) => string;
  showStudent?: boolean;
  emptyTitle: string;
  emptyBody: string;
  filtered?: boolean;
}) {
  if (requests.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-medium">
          {filtered ? "No requests match these filters" : emptyTitle}
        </p>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm">
          {filtered
            ? "Try a wider date range or a different status."
            : emptyBody}
        </p>
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
