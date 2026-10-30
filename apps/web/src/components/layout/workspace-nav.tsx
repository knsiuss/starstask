"use client";

import {
  CalendarDays,
  ClipboardList,
  Compass,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  requiresAuth?: boolean;
};

const MAIN_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    requiresAuth: true,
  },
  { href: "/assignments", label: "Assignments", icon: Compass },
  { href: "/classes", label: "Classes", icon: GraduationCap },
  {
    href: "/leave-requests",
    label: "Absence requests",
    icon: ClipboardList,
    requiresAuth: true,
  },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  {
    href: "/my-assignments",
    label: "My submissions",
    icon: FileText,
    requiresAuth: true,
  },
];

const ACCOUNT_ITEMS: NavItem[] = [
  {
    href: "/settings/profile",
    label: "Profile",
    icon: UserRound,
    requiresAuth: true,
  },
  {
    href: "/settings/notifications",
    label: "Settings",
    icon: Settings,
    requiresAuth: true,
  },
  {
    href: "/settings/calendar",
    label: "Google Calendar",
    icon: CalendarDays,
    requiresAuth: true,
  },
];

type WorkspaceNavProps = {
  isAuthenticated: boolean;
  /** Closes the mobile drawer after a link is followed. */
  onNavigate?: () => void;
};

/**
 * Student navigation.
 *
 * Platform and developer consoles deliberately have their own shells and
 * navigation. Keeping operator links out of this list is the visible half of
 * the separation; access is still enforced server-side on every console route.
 */
export function WorkspaceNav({
  isAuthenticated,
  onNavigate,
}: WorkspaceNavProps) {
  const pathname = usePathname();

  const items = [
    ...MAIN_ITEMS,
    ...(isAuthenticated ? ACCOUNT_ITEMS : []),
  ].filter((item) => !item.requiresAuth || isAuthenticated);

  // Pick the most specific match so a nested page keeps its section active.
  const activeHref = items
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((left, right) => right.length - left.length)[0];

  const renderItem = (item: NavItem) => {
    if (item.requiresAuth && !isAuthenticated) {
      return null;
    }

    const isActive = item.href === activeHref;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            isActive
              ? "bg-accent-soft text-accent font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <item.icon
            aria-hidden="true"
            className="h-[18px] w-[18px] shrink-0"
          />
          <span className="truncate">{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <NavSection label="Student">{MAIN_ITEMS.map(renderItem)}</NavSection>
      {isAuthenticated ? (
        <NavSection label="Account">{ACCOUNT_ITEMS.map(renderItem)}</NavSection>
      ) : null}
    </div>
  );
}

function NavSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground px-3 text-[11px] font-medium tracking-[0.08em] uppercase">
        {label}
      </p>
      <ul className="mt-2 space-y-1">{children}</ul>
    </div>
  );
}
