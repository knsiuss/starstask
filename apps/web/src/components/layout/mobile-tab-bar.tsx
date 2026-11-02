"use client";

import {
  CalendarDays,
  ClipboardList,
  Compass,
  LayoutDashboard,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

type TabItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const TABS: TabItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assignments", label: "Assignments", icon: Compass },
  { href: "/attendance", label: "Attendance", icon: UserCheck },
  // The aggregated calendar, not `/sessions`: discussion sessions are one event
  // source inside it, and the tab used to open that narrower list instead.
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/leave-requests", label: "Absence", icon: ClipboardList },
];

/**
 * One-tap destinations on small screens.
 *
 * Profile and Settings stay in the drawer and the topbar account menu, which
 * leaves room for Attendance in the five daily destinations. Hidden at `lg`,
 * where the sidebar takes over.
 */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] transition-colors",
                  isActive
                    ? "text-accent font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon
                  aria-hidden="true"
                  className="h-5 w-5"
                />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
