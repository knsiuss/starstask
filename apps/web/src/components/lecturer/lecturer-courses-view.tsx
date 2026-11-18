import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Layers,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type LecturerBapSummary } from "@/lib/lecturer/bap-progress";
import { pluralize } from "@starstask/shared";

type LecturerCoursesViewProps = {
  summary: LecturerBapSummary;
};

/**
 * Course-first directory for lecturers on `/classes`.
 *
 * Groups teaching work by `course_offering` x `class`, linking directly into
 * each course workspace (attendance, assignments, schedule) while keeping the
 * parent class link one click away.
 */
export function LecturerCoursesView({ summary }: LecturerCoursesViewProps) {
  if (summary.offerings.length === 0) {
    return (
      <Card className="border-dashed p-6">
        <p className="text-sm font-medium">No active course offerings yet</p>
        <p className="text-muted-foreground mt-1 max-w-lg text-sm leading-relaxed">
          Once you create a class, add a course offering, or join a class via
          your teaching schedule, each course you teach will appear here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
          >
            <Link href="/classes/create">Create class</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="secondary"
          >
            <Link href="/classes/create?tab=krs">Import KRS / Schedule</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="secondary"
          >
            <Link href="/classes/join">Join a class</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {summary.offerings.map((item) => {
        const courseBase = item.subjectId
          ? `/classes/${item.classSlug}/courses/${item.subjectId}`
          : `/classes/${item.classSlug}/courses`;
        const progressPercent = item.progressPercent;

        return (
          <li key={item.offeringId}>
            <Card className="flex h-full flex-col p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/classes/${item.classSlug}`}
                  className="bg-muted text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors"
                >
                  <Layers
                    aria-hidden="true"
                    className="h-3 w-3"
                  />
                  {item.className}
                </Link>

                {item.missingBapCount > 0 ? (
                  <Badge variant="warning">
                    {item.missingBapCount} missing BAP
                  </Badge>
                ) : item.isBelowTarget ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {item.meetingsHeld}/{item.targetMeetings} meetings
                  </span>
                ) : null}
              </div>

              <h2 className="mt-2.5 text-base leading-snug font-semibold">
                <Link
                  href={courseBase}
                  className="hover:text-accent focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {item.courseName}
                </Link>
              </h2>

              <div className="mt-3 space-y-1.5">
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>Teaching progress</span>
                  <span className="tabular-nums">
                    {item.meetingsHeld} / {item.targetMeetings}{" "}
                    {pluralize(item.targetMeetings, "meeting")}
                  </span>
                </div>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-accent h-full rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 pt-4 text-xs font-medium">
                <Link
                  href={courseBase}
                  className="text-accent hover:text-accent-hover inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  <BookOpen
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Course
                </Link>
                <Link
                  href={`${courseBase}/attendance`}
                  className="text-accent hover:text-accent-hover inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  <ClipboardCheck
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Attendance
                </Link>
                <Link
                  href={`${courseBase}/assignments`}
                  className="text-accent hover:text-accent-hover inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  <FileText
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Assignments
                </Link>
                <Link
                  href={`${courseBase}/schedule`}
                  className="text-accent hover:text-accent-hover inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  <CalendarDays
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Schedule
                </Link>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
