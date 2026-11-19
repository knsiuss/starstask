import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Download,
  Users,
} from "lucide-react";

import { ClassSwitcherSelect } from "@/components/actions/class-switcher-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { AttendanceMeetingListItem } from "@/lib/attendance/meeting-types";
import { formatLeaveDate } from "@starstask/shared";

import { cn } from "@/lib/utils/cn";

/**
 * Charcoal + sage dark palette, scoped to this file. Light mode keeps the
 * shared theme tokens untouched; dark mode re-points the same surfaces at the
 * lecturer console's charcoal panel so this tab reads as one with it.
 */
const PANEL =
  "border-border bg-surface text-foreground dark:border-white/[0.06] dark:bg-[#23231f] dark:text-[#ece9e3]";
const PANEL_SUBTLE =
  "border-border bg-subtle dark:border-white/[0.08] dark:bg-white/[0.03]";
const BAND = "bg-band text-foreground dark:bg-white/[0.03] dark:text-[#ece9e3]";
const MUTED_TEXT = "text-muted-foreground dark:text-[#a19d92]";
const SAGE_ICON = "dark:text-[#a3b07d]";
const SECONDARY_BUTTON_DARK =
  "dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#ece9e3] dark:hover:bg-white/[0.08]";
const PRIMARY_BUTTON_DARK =
  "dark:bg-[#5b6b45] dark:text-white dark:hover:bg-[#4a5838]";

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
      <div
        className={cn(
          "mt-4 rounded-xl border border-dashed px-6 py-10 text-center",
          PANEL_SUBTLE,
        )}
      >
        <p className="text-sm font-medium dark:text-[#ece9e3]">
          No classes to show yet
        </p>
        <p
          className={cn(
            "mx-auto mt-1 max-w-sm text-xs leading-relaxed",
            MUTED_TEXT,
          )}
        >
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
        action="/actions"
        method="get"
        className={cn(
          "flex items-end gap-2 rounded-xl border p-3 sm:p-4",
          PANEL,
        )}
      >
        <input
          type="hidden"
          name="tab"
          value="attendance"
        />
        <div className="min-w-0 flex-1">
          <Label
            htmlFor="attendance-class"
            className="dark:text-[#aaa69e]"
          >
            Class
          </Label>
          <ClassSwitcherSelect
            id="attendance-class"
            name="class"
            defaultValue={selected.id}
            className="mt-1 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#ece9e3]"
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
          </ClassSwitcherSelect>
        </div>
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          className={cn("shrink-0", SECONDARY_BUTTON_DARK)}
        >
          Show
        </Button>
      </form>

      <dl className="grid grid-cols-4 gap-1.5 sm:gap-2.5 lg:gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card
              key={stat.label}
              className={cn(
                PANEL,
                "min-w-0 px-2 py-2.5 text-center sm:p-3.5 sm:text-left",
              )}
            >
              <dt
                className={cn(
                  "flex flex-col items-center gap-1 text-[11px] sm:flex-row sm:gap-2 sm:text-xs",
                  MUTED_TEXT,
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn("h-3.5 w-3.5 shrink-0", SAGE_ICON)}
                />
                <span className="max-w-full truncate">{stat.label}</span>
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums dark:text-[#ece9e3] sm:text-2xl">
                {stat.value}
              </dd>
            </Card>
          );
        })}
      </dl>

      {latestActivity ? (
        <p
          className={cn("rounded-xl px-3.5 py-3 text-xs leading-relaxed", BAND)}
        >
          Latest attendance activity: Meeting {latestActivity.meetingNumber} in{" "}
          {latestActivity.subjectName} on{" "}
          {formatLeaveDate(latestActivity.startsAt.slice(0, 10))}(
          {PHASE_LABELS[latestActivity.phase]})
        </p>
      ) : (
        <p
          className={cn("rounded-xl px-3.5 py-3 text-xs leading-relaxed", BAND)}
        >
          No attendance recorded for this class yet.
        </p>
      )}

      {courses.length === 0 ? (
        <div
          className={cn(
            "rounded-xl border border-dashed px-6 py-10 text-center",
            PANEL_SUBTLE,
          )}
        >
          <p className="text-sm font-medium dark:text-[#ece9e3]">
            No courses in this class
          </p>
          <p
            className={cn(
              "mx-auto mt-1 max-w-sm text-xs leading-relaxed",
              MUTED_TEXT,
            )}
          >
            Add a course from Manage Class before exporting attendance.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {courses.map((course) => {
            const latest = latestMeeting(course.meetings);
            const viewHref = `/classes/${selected.slug}/courses/${course.id}/attendance`;
            const exportHref = `/api/classes/${selected.slug}/attendance/exports/recap?subjectId=${course.id}`;

            return (
              <li
                key={course.id}
                className={cn("rounded-xl border p-4", PANEL)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground min-w-0 truncate text-[15px] font-semibold tracking-tight dark:text-[#ece9e3]">
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
                    <p className={cn("mt-0.5 text-xs", MUTED_TEXT)}>
                      {course.code ?? "No code"}
                    </p>
                  </div>
                  <a
                    href={viewHref}
                    aria-label={`View attendance for ${course.name}`}
                    className="text-muted-foreground hover:text-foreground focus-visible:outline-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#a19d92] dark:hover:bg-white/[0.06] dark:hover:text-[#ece9e3]"
                  >
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </a>
                </div>

                <div className="border-border mt-3 grid grid-cols-2 gap-3 border-t pt-3 dark:border-white/[0.06]">
                  <div className="min-w-0">
                    <div
                      className={cn(
                        "flex items-center gap-1.5 text-[11px]",
                        MUTED_TEXT,
                      )}
                    >
                      <Users
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      Lecturer
                    </div>
                    <p className="mt-0.5 text-sm font-medium dark:text-[#ece9e3]">
                      {course.lecturerName ?? "Not set"}
                    </p>
                  </div>
                  <div className="border-border min-w-0 border-l pl-3 dark:border-white/[0.06]">
                    <div
                      className={cn(
                        "flex items-center gap-1.5 text-[11px]",
                        MUTED_TEXT,
                      )}
                    >
                      <CalendarDays
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      Recorded
                    </div>
                    <p className="mt-0.5 text-sm font-medium dark:text-[#ece9e3]">
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
                    className={cn("min-w-0", SECONDARY_BUTTON_DARK)}
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
                    className={cn("min-w-0", PRIMARY_BUTTON_DARK)}
                  >
                    <a
                      href={exportHref}
                      className="truncate"
                    >
                      <Download
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      Export Attendance
                    </a>
                  </Button>
                </div>

                {latest ? (
                  <p className={cn("mt-2.5 text-[11px]", MUTED_TEXT)}>
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
