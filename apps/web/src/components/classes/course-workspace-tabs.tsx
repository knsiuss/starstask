import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export const COURSE_TABS = [
  "overview",
  "assignments",
  "materials",
  "announcements",
  "members",
  "attendance",
  "schedule",
] as const;

export type CourseTab = (typeof COURSE_TABS)[number];

export const COURSE_TAB_LABELS: Record<CourseTab, string> = {
  overview: "Overview",
  assignments: "Assignments",
  materials: "Materials",
  announcements: "Announcements",
  members: "Members",
  attendance: "Attendance",
  schedule: "Schedule",
};

export function isCourseTab(value: string | undefined): value is CourseTab {
  return (
    value !== undefined && (COURSE_TABS as readonly string[]).includes(value)
  );
}

export function courseTabHref(
  slug: string,
  courseId: string,
  tab: CourseTab,
): string {
  const base = `/dashboard/classes/${slug}/courses/${courseId}`;

  return tab === "overview" ? base : `${base}/${tab}`;
}

type CourseWorkspaceTabsProps = {
  slug: string;
  courseId: string;
  /** Omitted on screens outside the tab set, such as course settings. */
  activeTab?: CourseTab;
};

/** Section navigation for one course. Every tab is a real, shareable route. */
export function CourseWorkspaceTabs({
  slug,
  courseId,
  activeTab,
}: CourseWorkspaceTabsProps) {
  return (
    <nav
      aria-label="Course sections"
      className="border-border mt-5 overflow-x-auto border-b"
    >
      <ul className="-mb-px flex min-w-max items-center gap-1">
        {COURSE_TABS.map((tab) => {
          const isActive = tab === activeTab;

          return (
            <li key={tab}>
              <Link
                href={courseTabHref(slug, courseId, tab)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {COURSE_TAB_LABELS[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
