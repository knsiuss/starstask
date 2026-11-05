import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Download,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AttendanceMeetingListItem } from "@/lib/attendance/meeting-types";
import { formatLeaveDate } from "@starstask/shared";

export type AttendanceClassOption = {
  id: string;
  slug: string;
  name: string;
  code: string | null;
  semester: string;
  academicYear: string;
};

export type AttendanceCourseRow = {
  id: string;
  name: string;
  code: string | null;
  lecturerName: string | null;
  meetings: AttendanceMeetingListItem[];
};

const PHASE_LABELS: Record<AttendanceMeetingListItem["phase"], string> = {
  scheduled: "Scheduled",
  open: "In progress",
  closed: "Closed",
  finalized: "Completed",
};

function latestMeeting(meetings: AttendanceMeetingListItem[]) {
  return [...meetings].sort((left, right) =>
    right.startsAt.localeCompare(left.startsAt),
  )[0];
}

/**
 * Attendance tab for one managed class.
 *
 * Metrics and per-course rows come from the real meeting list
 * (`class_attendance_meeting_list` RPC): total recorded sessions per course,
 * the latest recorded meeting, and its lifecycle phase as the completion
 * status. View opens the existing course attendance page; Export downloads the
 * existing per-course recap workbook — no second export implementation lives
 * here.
 */
export function AttendanceTab({
  classes,
  selected,
  courses,
  totalStudents,
  pendingForClass,
}: {
  classes: AttendanceClassOption[];
  selected: AttendanceClassOption | null;
  courses: AttendanceCourseRow[];
  totalStudents: number;
  pendingForClass: number;
}) {
  if (!selected) {
    return (
      <div className="border-border bg-subtle mt-4 rounded-xl border border-dashed px-6 py-10 text-center">
        <p className="text-sm font-medium">No classes to show yet</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
          Administer an active class to see its attendance overview here.
        </p>
      </div>
    );
  }

  const allMeetings = courses.flatMap((course) => course.meetings);
  const latestActivity = latestMeeting(allMeetings);

  const stats = [
    {
      icon: BookOpen,
      label: "Total courses",
      value: courses.length,
    },
    {
      icon: CalendarDays,
      label: "Recorded sessions",
      value: allMeetings.length,
    },
    {
      icon: Users,
      label: "Total students",
      value: totalStudents,
    },
    {
      icon: Clock3,
      label: "Pending requests",
      value: pendingForClass,
    },
  ];

  return (
    <div className="mt-4 space-y-4">
      <form
        action="/app/actions?tab=attendance"
        method="get"
        className="border-border bg-card flex items-center gap-2 rounded-xl border p-3 sm:p-4"
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="attendance-class">Class</Label>
          <Select
            id="attendance-class"
            name="class"
            defaultValue={selected.id}
            className="mt-1"
          >
            {classes.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.code
                  ? `${item.code} — Semester ${item.semester} (${item.academicYear})`
                  : `${item.name} — Semester ${item.semester} (${item.academicYear})`}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          className="shrink-0"
        >
          Show
        </Button>
      </form>

      <dl className="grid grid-cols-2 gap-2.5 lg:gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card
              key={stat.label}
              className="p-3.5"
            >
              <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                <Icon
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                {stat.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {stat.value}
              </dd>
            </Card>
          );
        })}
      </dl>

      {latestActivity ? (
        <p className="bg-band text-foreground rounded-xl px-3.5 py-3 text-xs leading-relaxed">
          Latest attendance activity: Meeting {latestActivity.meetingNumber} in{" "}
          {latestActivity.subjectName} on{" "}
          {formatLeaveDate(latestActivity.startsAt.slice(0, 10))}(
          {PHASE_LABELS[latestActivity.phase]})
        </p>
      ) : (
        <p className="bg-band text-foreground rounded-xl px-3.5 py-3 text-xs leading-relaxed">
          No attendance recorded for this class yet.
        </p>
      )}

      {courses.length === 0 ? (
        <div className="border-border bg-subtle rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">No courses in this class</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
            Add a course from Manage Class before exporting attendance.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {courses.map((course) => {
            const latest = latestMeeting(course.meetings);
            const viewHref = `/app/classes/${selected.slug}/courses/${course.id}/attendance`;
            const exportHref = `/api/classes/${selected.slug}/attendance/exports/recap?subjectId=${course.id}`;

            return (
              <li
                key={course.id}
                className="border-border bg-surface rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground min-w-0 truncate text-[15px] font-semibold tracking-tight">
                        {course.name}
                      </h3>
                      {latest ? (
                        <Badge
                          variant={
                            latest.phase === "finalized"
                              ? "success"
                              : latest.phase === "open"
                                ? "accent"
                                : "neutral"
                          }
                        >
                          {PHASE_LABELS[latest.phase]}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {course.code ?? "No code"}
                    </p>
                  </div>
                  <a
                    href={viewHref}
                    aria-label={`View attendance for ${course.name}`}
                    className="text-muted-foreground hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  >
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </a>
                </div>

                <div className="border-border mt-3 grid grid-cols-2 gap-3 border-t pt-3">
                  <div className="min-w-0">
                    <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                      <Users
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      Lecturer
                    </div>
                    <p className="mt-0.5 text-sm font-medium">
                      {course.lecturerName ?? "Not set"}
                    </p>
                  </div>
                  <div className="min-w-0 border-l border-border pl-3">
                    <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                      <CalendarDays
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      Recorded
                    </div>
                    <p className="mt-0.5 text-sm font-medium">
                      {course.meetings.length}{" "}
                      {course.meetings.length === 1 ? "meeting" : "meetings"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="min-w-0"
                  >
                    <a
                      href={viewHref}
                      className="truncate"
                    >
                      View attendance
                    </a>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="min-w-0"
                  >
                    <a
                      href={exportHref}
                      className="truncate"
                    >
                      Export Attendance
                    </a>
                  </Button>
                </div>

                {latest ? (
                  <p className="text-muted-foreground mt-2.5 text-[11px]">
                    Latest Meeting {latest.meetingNumber} on{" "}
                    {formatLeaveDate(latest.startsAt.slice(0, 10))}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
