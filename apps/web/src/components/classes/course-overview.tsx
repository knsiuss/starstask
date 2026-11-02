import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  ClassSubjectView,
  CourseMaterialKind,
  CourseMaterialView,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import type { ClassScheduleEntry } from "@/lib/db/class-schedule";
import type { CourseAssignmentSummary } from "@/lib/db/classes";

const MATERIAL_KIND_LABELS: Record<CourseMaterialKind, string> = {
  document: "Document",
  video: "Video",
  link: "Link",
  other: "Other",
};

const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

type CourseOverviewProps = {
  courseBase: string;
  course: ClassSubjectView;
  semester: string;
  academicYear: string;
  announcements: CourseAssignmentSummary[];
  recentAssignments: CourseAssignmentSummary[];
  upcomingAssignments: CourseAssignmentSummary[];
  materials: CourseMaterialView[];
  scheduleEntries: ClassScheduleEntry[];
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
  academicYear,
  announcements,
  recentAssignments,
  upcomingAssignments,
  materials,
  scheduleEntries,
}: CourseOverviewProps) {
  const weeklySlots = [...scheduleEntries]
    .sort(
      (first, second) =>
        first.day_of_week - second.day_of_week ||
        first.start_time.localeCompare(second.start_time),
    )
    .slice(0, 5);

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

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <SectionCard
          title="Recent announcements"
          action={{
            href: `${courseBase}/announcements`,
            label: "All announcements",
          }}
        >
          {announcements.length === 0 ? (
            <EmptyLine>No announcements in this course yet.</EmptyLine>
          ) : (
            <ul className="divide-border divide-y">
              {announcements.map((announcement) => (
                <li
                  key={announcement.id}
                  className="py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/assignments/${announcement.id}`}
                      className="text-accent text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {announcement.title}
                    </Link>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(
                        announcement.published_at ?? announcement.created_at,
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

        <SectionCard
          title="Upcoming assignments"
          action={{
            href: `${courseBase}/assignments`,
            label: "All assignments",
          }}
        >
          {upcomingAssignments.length === 0 ? (
            <EmptyLine>No upcoming deadlines in this course.</EmptyLine>
          ) : (
            <ul className="divide-border divide-y">
              {upcomingAssignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="text-accent text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {assignment.title}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    Due{" "}
                    {formatDate(assignment.deadline ?? assignment.created_at)}
                    {assignment.attachment_count > 0
                      ? ` · ${attachmentCount(assignment.attachment_count)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recently published materials"
          action={{ href: `${courseBase}/materials`, label: "All materials" }}
        >
          {materials.length === 0 ? (
            <EmptyLine>No learning material in this course yet.</EmptyLine>
          ) : (
            <ul className="divide-border divide-y">
              {materials.slice(0, 3).map((material) => (
                <li
                  key={material.id}
                  className="py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="text-sm font-medium">
                        {material.title}
                      </span>
                      <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[10px]">
                        {MATERIAL_KIND_LABELS[material.kind]}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(material.created_at)}
                    </span>
                  </div>
                  {material.resource_url ? (
                    <a
                      href={material.resource_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent mt-0.5 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    >
                      Open resource
                      <ExternalLink
                        aria-hidden="true"
                        className="h-3 w-3"
                      />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

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
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0">
                    <span className="text-muted-foreground mr-2 text-[10px] font-medium tracking-wide uppercase">
                      {item.kind}
                    </span>
                    <Link
                      href={item.href}
                      className="text-sm underline-offset-4 hover:underline"
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

      <aside className="space-y-4">
        <SideCard title="Course information">
          <dl className="mt-3 space-y-2 text-sm">
            <InfoRow
              label="Code"
              value={course.code ?? "Not set"}
            />
            <InfoRow
              label="Term"
              value={`${semester} ${academicYear}`}
            />
            <InfoRow
              label="Lecturer"
              value={course.lecturer_name ?? "Not set"}
            />
            <InfoRow
              label="Status"
              value={course.status === "active" ? "Active" : "Archived"}
            />
          </dl>
        </SideCard>

        <SideCard title="Schedule">
          {weeklySlots.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              No weekly slot saved for this course.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {weeklySlots.map((slot) => (
                <li
                  key={slot.id}
                  className="text-muted-foreground text-xs"
                >
                  <span className="text-foreground font-medium">
                    {DAY_LABELS[slot.day_of_week] ?? "Day"}
                  </span>{" "}
                  {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                  {slot.room ? ` · ${slot.room}` : ""}
                </li>
              ))}
            </ul>
          )}
        </SideCard>

        <SideCard title="Quick links">
          <ul className="mt-2 space-y-1">
            {[
              { href: `${courseBase}/assignments`, label: "Assignments" },
              { href: `${courseBase}/materials`, label: "Materials" },
              { href: `${courseBase}/announcements`, label: "Announcements" },
              { href: `${courseBase}/members`, label: "Members" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
                >
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </SideCard>
      </aside>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-surface rounded-xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
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
  return <p className="text-muted-foreground py-1 text-xs">{children}</p>;
}

function attachmentCount(count: number): string {
  return `${count} ${count === 1 ? "attachment" : "attachments"}`;
}
