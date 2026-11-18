"use client";

import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ACCOUNT_ITEMS,
  LEADER_ITEMS,
  STUDY_ITEMS,
  TEACHING_ITEMS,
  UNIVERSITY_ITEMS,
  getActiveNavHref,
  type NavItem,
} from "@/components/layout/workspace-nav-items";
import { cn } from "@/lib/utils/cn";
type WorkspaceNavProps = {
  isAuthenticated: boolean;
  /** Renders the Action center; true only for users leading a class. */
  isClassAdmin?: boolean;
  /** Renders the Teaching section first; true only for verified lecturers. */
  isLecturer?: boolean;
  /** Icon-only rendering for the collapsed desktop sidebar. */
  compact?: boolean;
  /** Menampilkan section University Info (UNPAM/FTI). */
  showUniversityInfo?: boolean;
  /** Closes the mobile drawer after a link is followed. */
  onNavigate?: () => void;
};

/**
 * Role-aware workspace navigation.
 *
 * A lecturer sees only the Teaching section (plus Campus/Account when enabled)
 * without the default "My studies" section; `/app?view=student` remains
 * available as an escape hatch. Class admins gain the leader section and
 * management actions inside My Classes. Platform and developer consoles
 * deliberately have their own shells; access is still enforced server-side on
 * every console route.
 */
export function WorkspaceNav({
  isAuthenticated,
  isClassAdmin = false,
  isLecturer = false,
  compact = false,
  showUniversityInfo = false,
  onNavigate,
}: WorkspaceNavProps) {
  const pathname = usePathname();
  const studyItems = isLecturer ? [] : STUDY_ITEMS;

  const items = [
    ...(isLecturer ? TEACHING_ITEMS : []),
    ...studyItems,
    // Teaching already carries the Action center, so a lecturer never gets it twice.
    ...(isClassAdmin && !isLecturer ? LEADER_ITEMS : []),
    ...(showUniversityInfo ? UNIVERSITY_ITEMS : []),
    ...(isAuthenticated ? ACCOUNT_ITEMS : []),
  ].filter((item) => !item.requiresAuth || isAuthenticated);

  // Pick the most specific match so a nested page keeps its section active.
  const activeHref = getActiveNavHref(
    pathname,
    items.map((item) => item.href),
  );

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
          aria-label={compact ? item.label : undefined}
          title={compact ? item.label : undefined}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            compact && "justify-center px-2",
            isActive
              ? "bg-accent-soft text-accent font-medium dark:bg-[#2563eb] dark:text-white"
              : "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-[#8b98b8] dark:hover:bg-white/[0.06] dark:hover:text-[#eef2fb]",
          )}
        >
          <NavIcon Icon={item.icon} />
          <span className={cn("truncate", compact && "sr-only")}>
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {isLecturer && isAuthenticated ? (
        <NavSection
          label="Teaching"
          compact={compact}
        >
          {TEACHING_ITEMS.map(renderItem)}
        </NavSection>
      ) : null}
      {!isLecturer ? (
        <NavSection
          label="Study"
          compact={compact}
        >
          {studyItems.map(renderItem)}
        </NavSection>
      ) : null}
      {isClassAdmin && !isLecturer && isAuthenticated ? (
        <NavSection
          label="Class leader"
          compact={compact}
        >
          {LEADER_ITEMS.map(renderItem)}
        </NavSection>
      ) : null}
      {showUniversityInfo ? (
        <NavSection
          label="Campus"
          compact={compact}
        >
          {UNIVERSITY_ITEMS.map(renderItem)}
        </NavSection>
      ) : null}
      {isAuthenticated ? (
        <NavSection
          label="Account"
          compact={compact}
        >
          {ACCOUNT_ITEMS.map(renderItem)}
        </NavSection>
      ) : null}
    </div>
  );
}

function NavIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <Icon
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
    />
  );
}

function NavSection({
  label,
  compact,
  children,
}: {
  label: string;
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : (
        <p className="text-muted-foreground dark:text-[#8b98b8] px-3 text-[11px] font-medium tracking-[0.12em] uppercase">
          {label}
        </p>
      )}
      <ul className={cn("space-y-1", !compact && "mt-2")}>{children}</ul>
    </div>
  );
}
