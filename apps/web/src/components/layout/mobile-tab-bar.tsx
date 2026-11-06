"use client";

import {
  CalendarDays,
  ClipboardList,
  Compass,
  LayoutDashboard,
  Loader2,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useLinkStatus } from "next/link";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5 gap-1 px-2 pt-2">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] transition-all duration-150 active:scale-95",
                  isActive
                    ? "tile-blue font-semibold text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <TabIcon
                  Icon={tab.icon}
                  isActive={isActive}
                />
                <span className="max-w-full truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Swaps the destination icon for a spinner while its navigation is pending,
 * so a tap on a slow (force-dynamic) route reads as immediate feedback
 * instead of a frozen screen until the server responds.
 */
function TabIcon({ Icon, isActive }: { Icon: LucideIcon; isActive: boolean }) {
  const { pending } = useLinkStatus();

  if (pending && !isActive) {
    return (
      <Loader2
        aria-hidden="true"
        className="h-5 w-5 animate-spin"
      />
    );
  }

  return (
    <Icon
      aria-hidden="true"
      className="h-5 w-5"
    />
  );
}
