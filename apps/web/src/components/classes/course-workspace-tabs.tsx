import { TabStrip } from "@/components/ui/tab-strip";

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
    <TabStrip
      label="Course sections"
      className="mt-5"
      items={COURSE_TABS.map((tab) => ({
        href: courseTabHref(slug, courseId, tab),
        label: COURSE_TAB_LABELS[tab],
        active: tab === activeTab,
      }))}
    />
  );
}
