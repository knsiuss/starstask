import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  FileText,
  Megaphone,
  Paperclip,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  ClassSubjectView,
  CourseMaterialKind,
  CourseMaterialView,
} from "@starstask/contracts";
import { formatDate, formatTimeRemaining } from "@starstask/shared";

import type { GroupedUpcomingAssignments } from "@/features/classes/course-assignment-filters";
import type {
  CourseAssignmentSummary,
  CourseContentCounts,
} from "@/lib/db/classes";
import { cn } from "@/lib/utils/cn";

const MATERIAL_KIND_LABELS: Record<CourseMaterialKind, string> = {
  document: "Document",
  video: "Video",
  link: "Link",
  other: "Other",
};

type CourseOverviewProps = {
  courseBase: string;
  course: ClassSubjectView;
  semester: string;
  academicYear: string;
  announcements: CourseAssignmentSummary[];
  recentAssignments: CourseAssignmentSummary[];
  upcomingAssignments: GroupedUpcomingAssignments<CourseAssignmentSummary>;
  materials: CourseMaterialView[];
  counts: CourseContentCounts;
  now?: Date;
};

type ActivityItem = {
  id: string;
  title: string;
  kind: string;
  at: string;
  href: string;
};

/**
 * The course overview: work that needs attention in the main column and the
 * reference details in the aside. Counts and charts are deliberately absent;
 * each block answers "what is here?" rather than "how many?".
 */
export function CourseOverview({
  courseBase,
  course,
  semester,
  announcements,
  recentAssignments,
  upcomingAssignments,
  materials,
  counts,
  now = new Date(),
}: CourseOverviewProps) {
  const activity: ActivityItem[] = [
    ...announcements.map((announcement) => ({
      id: `announcement-${announcement.id}`,
      title: announcement.title,
      kind: "Announcement",
      at: announcement.published_at ?? announcement.created_at,
      href: `/assignments/${announcement.id}`,
    })),
    ...recentAssignments.map((assignment) => ({
      id: `assignment-${assignment.id}`,
      title: assignment.title,
      kind: "Assignment",
      at: assignment.published_at ?? assignment.created_at,
      href: `/assignments/${assignment.id}`,
    })),
    ...materials.map((material) => ({
      id: `material-${material.id}`,
      title: material.title,
      kind: "Material",
      at: material.created_at,
      href: `${courseBase}/materials`,
    })),
  ]
    .sort((first, second) => second.at.localeCompare(first.at))
    .slice(0, 6);

  const hasUpcoming =
    upcomingAssignments.dueSoon.length > 0 ||
    upcomingAssignments.later.length > 0;

  return (
    // Mobile reads the published-work summary first, then course info,
    // upcoming work, and announcements; the two wrapper columns dissolve
    // into the flex flow on small screens and come back on lg.
    <div className="mt-5 space-y-4 sm:mt-6 sm:gap-5">
      <CourseOverviewStats counts={counts} />

      <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-start lg:gap-6">
        <div className="contents lg:block lg:min-w-0 lg:flex-[2] lg:space-y-4">
          <div className="order-4 lg:order-none">
            <SectionCard
              title="Recent announcements"
              action={{
                href: `${courseBase}/announcements`,
                label: "View all",
              }}
            >
              {announcements.length === 0 ? (
                <EmptyLine>No announcements in this course yet.</EmptyLine>
              ) : (
                <ul className="divide-border divide-y">
                  {announcements.map((announcement) => (
                    <li
                      key={announcement.id}
                      className="py-3 first:pt-1 last:pb-1"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={`/assignments/${announcement.id}`}
                          className="text-accent min-w-0 text-sm font-medium break-words underline-offset-4 hover:underline"
                        >
                          {announcement.title}
                        </Link>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatDate(
                            announcement.published_at ??
                              announcement.created_at,
                          )}
                        </span>
                      </div>
                      {announcement.description ? (
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                          {announcement.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="order-3 lg:order-none">
            <SectionCard
              title="Upcoming assignments"
              description="Assignments that will be due soon."
              action={{
                href: `${courseBase}/assignments`,
                label: "View all assignments",
              }}
            >
              {hasUpcoming ? (
                <div className="space-y-4">
                  <AssignmentGroup
                    label="Due soon"
                    assignments={upcomingAssignments.dueSoon}
                    now={now}
                  />
                  <AssignmentGroup
                    label="Later"
                    assignments={upcomingAssignments.later}
                    now={now}
                  />
                </div>
              ) : (
                <EmptyLine>No upcoming deadlines in this course.</EmptyLine>
              )}
            </SectionCard>
          </div>

          <div className="contents lg:grid lg:grid-cols-2 lg:gap-4">
            <div className="hidden lg:block">
              <SectionCard
                title="Recently published materials"
                action={{
                  href: `${courseBase}/materials`,
                  label: "View all materials",
                }}
              >
                {materials.length === 0 ? (
                  <EmptyLine>
                    No learning material in this course yet.
                  </EmptyLine>
                ) : (
                  <ul className="divide-border divide-y">
                    {materials.slice(0, 3).map((material) => (
                      <li
                        key={material.id}
                        className="py-3 first:pt-1 last:pb-1"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium">
                              {material.title}
                            </span>
                            <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 py-0.5 text-[10px]">
                              {MATERIAL_KIND_LABELS[material.kind]}
                            </span>
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {formatDate(material.created_at)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>

            <div className="hidden lg:block">
              <SectionCard title="Recent course activity">
                {activity.length === 0 ? (
                  <EmptyLine>
                    Nothing has been published in this course yet.
                  </EmptyLine>
                ) : (
                  <ul className="divide-border divide-y">
                    {activity.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-baseline justify-between gap-3 py-3 first:pt-1 last:pb-1"
                      >
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="bg-accent/10 text-accent shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                            {item.kind}
                          </span>
                          <Link
                            href={item.href}
                            className="min-w-0 text-sm break-words underline-offset-4 hover:underline"
                          >
                            {item.title}
                          </Link>
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatDate(item.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>
        </div>

        <aside className="contents lg:block lg:min-w-0 lg:space-y-4 lg:sticky lg:top-24">
          <div className="order-2 lg:order-none">
            <SideCard title="Course information">
              <dl className="mt-3 space-y-2.5 text-sm">
                <InfoRow
                  label="Code"
                  value={course.code ?? "Not set"}
                />
                <InfoRow
                  label="Semester"
                  value={semester || "Not set"}
                />
                <InfoRow
                  label="Lecturer"
                  value={course.lecturer_name ?? "Not set"}
                />
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">Status</dt>
                  <dd>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        course.status === "active"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          course.status === "active"
                            ? "bg-emerald-500"
                            : "bg-muted-foreground",
                        )}
                      />
                      {course.status === "active" ? "Active" : "Archived"}
                    </span>
                  </dd>
                </div>
              </dl>
            </SideCard>
          </div>

          <div className="hidden lg:block">
            <SideCard title="Quick links">
              <ul className="mt-2">
                {[
                  { href: `${courseBase}/assignments`, label: "Assignments" },
                  { href: `${courseBase}/materials`, label: "Materials" },
                  {
                    href: `${courseBase}/announcements`,
                    label: "Announcements",
                  },
                  { href: `${courseBase}/members`, label: "Members" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {link.label}
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </SideCard>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Compact activity counters for the course. Counts are exact published totals
 * (assignments include their content type), not the capped list lengths.
 */
function CourseOverviewStats({ counts }: { counts: CourseContentCounts }) {
  const tiles = [
    {
      icon: ClipboardList,
      label: "Assignments",
      value: counts.assignments,
      chip: "bg-accent-soft text-accent",
    },
    {
      icon: BookOpen,
      label: "Materials",
      value: counts.materials,
      chip: "bg-success-soft text-success",
    },
    {
      icon: Megaphone,
      label: "Announcements",
      value: counts.announcements,
      chip: "bg-warning-soft text-warning",
    },
    {
      icon: Activity,
      label: "Activities",
      value: counts.assignments + counts.announcements,
      chip: "bg-accent-soft text-accent",
    },
  ];

  return (
    <section
      aria-labelledby="course-overview-stats"
      className="border-border bg-surface rounded-xl border p-4 sm:p-5"
    >
      <h2
        id="course-overview-stats"
        className="text-foreground text-base font-semibold tracking-tight"
      >
        Course Overview
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => (
          <li
            key={tile.label}
            className={`flex items-center gap-2.5 rounded-xl p-3 ${tile.chip}`}
          >
            <span
              aria-hidden="true"
              className="bg-surface/70 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            >
              <tile.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="text-muted-foreground block truncate text-[11px]">
                {tile.label}
              </span>
              <span className="text-foreground block text-xl font-bold tabular-nums">
                {tile.value}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AssignmentGroup({
  label,
  assignments,
  now,
}: {
  label: string;
  assignments: CourseAssignmentSummary[];
  now: Date;
}) {
  if (assignments.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {label}
      </h3>
      <ul className="divide-border mt-1 divide-y">
        {assignments.map((assignment) => (
          <li key={assignment.id}>
            <Link
              href={`/assignments/${assignment.id}`}
              className="group hover:bg-muted/60 focus-visible:outline-accent -mx-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <FileText
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </span>
              <span className="min-w-0 flex-1 basis-48">
                <span className="block text-sm font-semibold break-words">
                  {assignment.title}
                </span>
                {assignment.source_label ? (
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                    {assignment.source_label}
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5 text-xs">
                  <CalendarDays
                    aria-hidden="true"
                    className="text-muted-foreground h-3.5 w-3.5"
                  />
                  <span className="font-medium">
                    Due {formatDate(assignment.deadline ?? now)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatTimeRemaining(assignment.deadline, now)}
                  </span>
                </span>
                {assignment.attachment_count > 0 ? (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Paperclip
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                    {assignment.attachment_count}{" "}
                    {assignment.attachment_count === 1 ? "file" : "files"}
                  </span>
                ) : null}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-surface rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="text-accent inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
          >
            {action.label}
            <ArrowRight
              aria-hidden="true"
              className="h-3 w-3"
            />
          </Link>
        ) : null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border bg-surface rounded-xl border p-4">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground py-4 text-center text-xs">{children}</p>
  );
}
