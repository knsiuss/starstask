import { TabStrip } from "@/components/ui/tab-strip";

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
    <TabStrip
      label="Attendance sections"
      items={ATTENDANCE_TABS.map((tab) => ({
        href: hrefFor(tab),
        label: TAB_LABELS[tab],
        active: tab === activeTab,
      }))}
    />
  );
}
