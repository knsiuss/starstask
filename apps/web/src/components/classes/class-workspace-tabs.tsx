import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The seven sections of one class group. "Courses" is a real route rather
 * than a query param because courses have their own nested pages underneath
 * it; the remaining tabs are `?tab=` views of the class page itself.
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
    <nav
      aria-label="Class sections"
      className="border-border mt-5 overflow-x-auto border-b"
    >
      <ul className="-mb-px flex min-w-max items-center gap-1">
        {CLASS_TABS.map((tab) => {
          const isActive = tab === activeTab;

          return (
            <li key={tab}>
              <Link
                href={classTabHref(slug, tab)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {CLASS_TAB_LABELS[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
