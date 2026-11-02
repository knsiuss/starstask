import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export const ATTENDANCE_TABS = ["check-in", "history"] as const;

export type AttendanceTab = (typeof ATTENDANCE_TABS)[number];

export function isAttendanceTab(
  value: string | undefined,
): value is AttendanceTab {
  return (
    value !== undefined &&
    (ATTENDANCE_TABS as readonly string[]).includes(value)
  );
}

function defaultTabHref(tab: AttendanceTab): string {
  return tab === "check-in" ? "/attendance" : "/attendance?tab=history";
}

const TAB_LABELS: Record<AttendanceTab, string> = {
  "check-in": "Check-in",
  history: "History",
};

type AttendanceTabsProps = {
  activeTab: AttendanceTab;
  /** Lets the class workspace keep its own URL instead of the global page. */
  hrefFor?: (tab: AttendanceTab) => string;
};

/** Real links keep both tabs server-rendered and shareable. */
export function AttendanceTabs({
  activeTab,
  hrefFor = defaultTabHref,
}: AttendanceTabsProps) {
  return (
    <nav
      aria-label="Attendance sections"
      className="border-border overflow-x-auto border-b"
    >
      <ul className="-mb-px flex min-w-max items-center gap-1">
        {ATTENDANCE_TABS.map((tab) => {
          const isActive = tab === activeTab;

          return (
            <li key={tab}>
              <Link
                href={hrefFor(tab)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {TAB_LABELS[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
