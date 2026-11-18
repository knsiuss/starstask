import { ClipboardCheck, Layers, ListChecks } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { LeaveRequestList } from "@/components/leave/leave-request-list";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type ActionCenterRow } from "@/lib/classes/action-center";
import { getClassActionCenter } from "@/lib/db/class-actions";
import { listManagedLeaveRequests } from "@/lib/db/leave";
import { getLecturerOverview } from "@/lib/db/lecturer";
import { pluralize } from "@starstask/shared";

type LecturerLeaveViewProps = {
  userId: string;
};

/**
 * Lecturer absence-review view rendered at `/leave-requests`.
 *
 * Replaces the student submission form with pending absence requests across
 * administered classes and direct links to `/actions?tab=absences` and each
 * class's `/classes/[slug]/leave-requests`.
 */
export async function LecturerLeaveView({ userId }: LecturerLeaveViewProps) {
  const [overview, actionCenter] = await Promise.all([
    getLecturerOverview(userId).catch(() => null),
    getClassActionCenter(userId).catch(() => null),
  ]);

  if (!overview) {
    return (
      <PageShell width="wide">
        <PageHeader
          title="Absence Requests"
          description="Review student absence requests across the classes you administer."
        />
        <Alert
          variant="error"
          className="mt-6"
        >
          Could not load your administered classes. Try again in a moment.
        </Alert>
      </PageShell>
    );
  }

  const managedClassIds = overview.classes.map((classItem) => classItem.id);
  const slugByClassId = new Map(
    overview.classes.map((classItem) => [classItem.id, classItem.slug]),
  );
  const actionByClassId = new Map<string, ActionCenterRow>(
    (actionCenter?.rows ?? []).map((row) => [row.classId, row]),
  );

  const pendingResult = await listManagedLeaveRequests(managedClassIds, {
    status: "submitted",
    page: 1,
    pageSize: 20,
    sort: "newest",
  }).catch(() => null);

  return (
    <PageShell width="wide">
      <PageHeader
        title="Absence Requests"
        description="Review pending student absence requests across the classes you administer."
        actions={
          <Button
            asChild
            size="sm"
          >
            <Link href="/actions?tab=absences">
              <ListChecks
                aria-hidden="true"
                className="h-4 w-4"
              />
              Open Action Center
            </Link>
          </Button>
        }
      />

      {overview.classes.length === 0 ? (
        <Card className="mt-6 px-5 py-12 text-center">
          <p className="text-sm font-medium">No administered classes yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
            Create or administer a class first to review student absence
            requests.
          </p>
          <Button
            asChild
            size="sm"
            className="mt-4"
          >
            <Link href="/classes">
              <Layers
                aria-hidden="true"
                className="h-4 w-4"
              />
              View classes
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="mt-6 space-y-8">
          <section aria-labelledby="lecturer-leave-classes">
            <h2
              id="lecturer-leave-classes"
              className="text-base font-semibold tracking-tight sm:text-lg"
            >
              Review by class
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Open a class queue to inspect supporting documents and approve or
              reject requests.
            </p>

            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {overview.classes.map((classItem) => {
                const pendingCount =
                  actionByClassId.get(classItem.id)?.pendingLeave ?? 0;

                return (
                  <li key={classItem.id}>
                    <Link
                      href={`/classes/${classItem.slug}/leave-requests`}
                      className="border-border bg-surface hover:border-accent/30 focus-visible:outline-accent flex h-full items-center justify-between gap-3 rounded-xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-semibold">
                          {classItem.name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {classItem.course_name}
                        </p>
                      </div>
                      <Badge
                        variant={pendingCount > 0 ? "warning" : "neutral"}
                        className="shrink-0"
                      >
                        {pendingCount} pending
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="lecturer-pending-leave">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h2
                  id="lecturer-pending-leave"
                  className="text-base font-semibold tracking-tight sm:text-lg"
                >
                  Pending absence requests
                </h2>
                {pendingResult ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums">
                    {pendingResult.total}{" "}
                    {pluralize(pendingResult.total, "request")}
                  </span>
                ) : null}
              </div>
              <Link
                href="/actions?tab=absences"
                className="text-accent inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
              >
                <ClipboardCheck
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Manage all in Action Center
              </Link>
            </div>

            <div className="mt-4">
              {pendingResult ? (
                <LeaveRequestList
                  requests={pendingResult.items}
                  showStudent
                  hrefFor={(request) => `/leave-requests/${request.id}`}
                  emptyTitle="No pending absence requests"
                  emptyBody="All submitted absence requests across your administered classes have been reviewed."
                />
              ) : (
                <Alert variant="error">
                  Could not load pending absence requests. Try again in a
                  moment.
                </Alert>
              )}
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
