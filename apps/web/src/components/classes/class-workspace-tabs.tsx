import {
  BookOpen,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Info,
  LayoutGrid,
  Users,
} from "lucide-react";

import { TabStrip } from "@/components/ui/tab-strip";
import type { ReactNode } from "react";

/**
 * The seven sections of one class group. "Courses" and "Attendance" are real
 * routes rather than query params because they own nested pages / their own
 * workspace; the remaining tabs are `?tab=` views of the class page itself.
 */
export const CLASS_TABS = [
  "overview",
  "courses",
  "assignments",
  "members",
  "schedule",
  "attendance",
  "info",
] as const;

export type ClassTab = (typeof CLASS_TABS)[number];

export const CLASS_TAB_LABELS: Record<ClassTab, string> = {
  overview: "Overview",
  courses: "Courses",
  assignments: "Assignments",
  members: "Members",
  schedule: "Schedule",
  attendance: "Attendance",
  info: "Class Info",
};

const CLASS_TAB_ICONS: Record<ClassTab, ReactNode> = {
  overview: (
    <LayoutGrid
      aria-hidden="true"
      className="h-4 w-4"
    />
  ),
  courses: (
    <BookOpen
      aria-hidden="true"
      className="h-4 w-4"
    />
  ),
  assignments: (
    <ClipboardList
      aria-hidden="true"
      className="h-4 w-4"
    />
  ),
  members: (
    <Users
      aria-hidden="true"
      className="h-4 w-4"
    />
  ),
  schedule: (
    <CalendarDays
      aria-hidden="true"
      className="h-4 w-4"
    />
  ),
  attendance: (
    <CircleCheck
      aria-hidden="true"
      className="h-4 w-4"
    />
  ),
  info: (
    <Info
      aria-hidden="true"
      className="h-4 w-4"
    />
  ),
};

export function isClassTab(value: string | undefined): value is ClassTab {
  return (
    value !== undefined && (CLASS_TABS as readonly string[]).includes(value)
  );
}

export function classTabHref(slug: string, tab: ClassTab): string {
  const base = `/dashboard/classes/${slug}`;

  if (tab === "courses") {
    return `${base}/courses`;
  }

  if (tab === "attendance") {
    return `${base}/attendance`;
  }

  return tab === "overview" ? base : `${base}?tab=${tab}`;
}

type ClassWorkspaceTabsProps = {
  slug: string;
  activeTab: ClassTab;
};

/** Section navigation. Real links keep every tab server-rendered and shareable. */
export function ClassWorkspaceTabs({
  slug,
  activeTab,
}: ClassWorkspaceTabsProps) {
  return (
    <TabStrip
      label="Class sections"
      className="mt-5"
      items={CLASS_TABS.map((tab) => ({
        href: classTabHref(slug, tab),
        label: CLASS_TAB_LABELS[tab],
        icon: CLASS_TAB_ICONS[tab],
        active: tab === activeTab,
      }))}
    />
  );
}
