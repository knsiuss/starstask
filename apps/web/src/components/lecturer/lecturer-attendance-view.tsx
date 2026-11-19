import {
  CalendarClock,
  Layers,
  ListChecks,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type ActionCenterRow } from "@/lib/classes/action-center";
import { listAttendanceMeetingCountsForClasses } from "@/lib/db/lecturer-attendance";
import { getClassActionCenter } from "@/lib/db/class-actions";
import { getLecturerOverview } from "@/lib/db/lecturer";
import { pluralize } from "@starstask/shared";

type LecturerAttendanceViewProps = {
  userId: string;
};

type ClassSessionSummary = {
  totalMeetings: number;
  openMeetings: number;
};

/**
 * Lecturer attendance overview rendered at `/attendance`.
 *
 * Replaces the student check-in form with per-class session counts and direct
 * management links to `/classes/[slug]/attendance` and `/classes/[slug]/sessions`.
 */
export async function LecturerAttendanceView({
  userId,
}: LecturerAttendanceViewProps) {
  const [overview, actionCenter] = await Promise.all([
    getLecturerOverview(userId).catch(() => null),
    getClassActionCenter(userId).catch(() => null),
  ]);

  if (!overview) {
    return (
      <PageShell width="wide">
        <PageHeader
          title="Attendance"
          description="Monitor attendance sessions across the classes you administer."
        />
        <Alert
          variant="error"
          className="mt-6"
        >
          Could not load your teaching attendance overview. Try again in a
          moment.
        </Alert>
      </PageShell>
    );
  }

  let meetingCounts: Map<string, ClassSessionSummary> | null = null;

  try {
    meetingCounts = await listAttendanceMeetingCountsForClasses(
      overview.classes.map((classItem) => classItem.id),
    );
  } catch {
    meetingCounts = null;
  }

  const sessionByClassId =
    meetingCounts ?? new Map<string, ClassSessionSummary>();
  const actionByClassId = new Map<string, ActionCenterRow>(
    (actionCenter?.rows ?? []).map((row) => [row.classId, row]),
  );
  const partialFailure = actionCenter === null || meetingCounts === null;

  const totalMeetings = overview.classes.reduce(
    (sum, classItem) =>
      sum + (sessionByClassId.get(classItem.id)?.totalMeetings ?? 0),
    0,
  );
  const todaysSessions = actionCenter?.totals.todaysSessions ?? 0;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Attendance"
        description="Monitor attendance sessions and jump straight into class attendance rosters."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link href="/attendance?view=student">Student view</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link href="/actions?tab=attendance">
                <ListChecks
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Action center
              </Link>
            </Button>
          </div>
        }
      />

      {partialFailure ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          Some attendance counts could not be loaded. Refresh to retry.
        </Alert>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium">
            Administered classes
          </p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {overview.classCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium">
            Recorded meetings
          </p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {totalMeetings}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium">
            Sessions today
          </p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {todaysSessions}
          </p>
        </Card>
      </div>

      {overview.classes.length === 0 ? (
        <Card className="mt-6 px-5 py-12 text-center">
          <p className="text-sm font-medium">No administered classes yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
            Create or administer a class first to manage attendance sessions and
            rosters.
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
        <section
          aria-labelledby="lecturer-attendance-classes"
          className="mt-8"
        >
          <h2
            id="lecturer-attendance-classes"
            className="text-base font-semibold tracking-tight sm:text-lg"
          >
            Classes you administer
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Open a class to record attendance, manage sessions, or review
            meeting topics.
          </p>

          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {overview.classes.map((classItem) => {
              const summary = sessionByClassId.get(classItem.id) ?? {
                totalMeetings: 0,
                openMeetings: 0,
              };
              const actionRow = actionByClassId.get(classItem.id);
              const todayCount = actionRow?.todaysSessions ?? 0;

              return (
                <li key={classItem.id}>
                  <Card className="flex h-full flex-col justify-between gap-4 p-4 sm:p-5">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-foreground truncate text-base font-semibold tracking-tight">
                            {classItem.name}
                          </h3>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {classItem.course_name}
                            <span aria-hidden="true"> · </span>
                            Semester {classItem.semester} (
                            {classItem.academic_year})
                          </p>
                        </div>
                        {summary.openMeetings > 0 ? (
                          <Badge variant="success">
                            {summary.openMeetings} open
                          </Badge>
                        ) : null}
                      </div>

                      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <Users
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                          {classItem.member_count}{" "}
                          {pluralize(classItem.member_count, "member")}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                          {summary.totalMeetings}{" "}
                          {pluralize(summary.totalMeetings, "meeting")}
                        </span>
                        {todayCount > 0 ? (
                          <span className="text-accent font-medium">
                            {todayCount} today
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        asChild
                        size="sm"
                      >
                        <Link href={`/classes/${classItem.slug}/attendance`}>
                          <Settings
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                          Manage attendance
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="secondary"
                      >
                        <Link href={`/classes/${classItem.slug}/sessions`}>
                          Sessions
                        </Link>
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
