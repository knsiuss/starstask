"use client";

import {
  CalendarDays,
  ClipboardList,
  Compass,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getActiveNavHref } from "@/components/layout/workspace-nav-items";
import { cn } from "@/lib/utils/cn";

type TabItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const TABS: TabItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assignments", label: "Assignments", icon: Compass },
  { href: "/attendance", label: "Attendance", icon: UserCheck },
  // The aggregated calendar, not `/sessions`: discussion sessions are one event
  // source inside it, and the tab used to open that narrower list instead.
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/leave-requests", label: "Absence", icon: ClipboardList },
];

/** A lecturer's five daily destinations: teaching and review come first. */
const TEACHING_TABS: TabItem[] = [
  { href: "/lecturer", label: "Teaching", icon: LayoutDashboard },
  { href: "/actions", label: "Review", icon: ListChecks },
  { href: "/classes", label: "Classes", icon: GraduationCap },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/attendance", label: "Attendance", icon: UserCheck },
];

/**
 * One-tap destinations on small screens.
 *
 * Profile and Settings stay in the drawer and the topbar account menu, which
 * leaves room for Attendance in the five daily destinations. Hidden at `lg`,
 * where the sidebar takes over.
 */
export function MobileTabBar({ isLecturer = false }: { isLecturer?: boolean }) {
  const pathname = usePathname();
  const tabs = isLecturer ? TEACHING_TABS : TABS;
  const activeHref = getActiveNavHref(
    pathname,
    tabs.map((tab) => tab.href),
  );

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-[#33332d] dark:bg-[#1e1e1a]"
    >
      <ul className="grid grid-cols-5 gap-1 px-2 pt-2">
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] transition-all duration-150 active:scale-95 sm:px-1 sm:text-[11px]",
                  isActive
                    ? "bg-accent-soft text-accent font-semibold dark:bg-[#5b6b45] dark:text-[#efede7]"
                    : "text-muted-foreground hover:text-foreground dark:text-[#a19d92] dark:hover:text-[#efede7]",
                )}
              >
                <TabIcon Icon={tab.icon} />
                <span className="max-w-full truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TabIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <Icon
      aria-hidden="true"
      className="h-5 w-5"
    />
  );
}
