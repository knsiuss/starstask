"use client";

import {
  BookOpenText,
  CalendarDays,
  ClipboardList,
  Compass,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  MessagesSquare,
  Settings,
  ShieldCheck,
  UserCheck,
  UserRound,
  Building2,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  requiresAuth?: boolean;
};

const STUDY_ITEMS: NavItem[] = [
  {
    href: "/app",
    label: "Dashboard",
    icon: LayoutDashboard,
    requiresAuth: true,
  },
  { href: "/assignments", label: "Assignments", icon: Compass },
  { href: "/classes", label: "My Classes", icon: GraduationCap },
  {
    href: "/attendance",
    label: "Attendance",
    icon: UserCheck,
    requiresAuth: true,
  },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  {
    href: "/leave-requests",
    label: "Absence Requests",
    icon: ClipboardList,
    requiresAuth: true,
  },
  {
    href: "/messages",
    label: "Messages",
    icon: MessagesSquare,
    requiresAuth: true,
  },
];

/**
 * Leader destinations render only for users who administer at least one class.
 * The flag is cosmetic; /app/actions re-checks every class role on load.
 */
const LEADER_ITEMS: NavItem[] = [
  {
    href: "/app/actions",
    label: "Action center",
    icon: ListChecks,
    requiresAuth: true,
  },
];

/**
 * Verified-lecturer destinations render only for users whose workspace context
 * carries `lecturer_anywhere`. The flag is cosmetic; /app/lecturer re-checks
 * the lecturer role server-side.
 */
const LECTURER_ITEMS: NavItem[] = [
  {
    href: "/app/lecturer",
    label: "Lecturer",
    icon: BookOpenText,
    requiresAuth: true,
  },
];

/**
 * Notifications and Google Calendar are deliberately absent: the topbar bell
 * owns notifications, and the calendar connection lives under Schedule and
 * Settings. A second sidebar destination would only duplicate them.
 */
/**
 * University Info hanya muncul untuk pengguna yang terhubung ke kampus
 * dengan plugin aktif (mis. UNPAM). Flag dari server/layout; default false
 * berarti menu tidak dirender sama sekali.
 */
const UNIVERSITY_ITEMS: NavItem[] = [
  {
    href: "/university-info",
    label: "University Info",
    icon: Building2,
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
    href: "/settings/security",
    label: "Security & Privacy",
    icon: ShieldCheck,
    requiresAuth: true,
  },
  {
    href: "/settings/feedback",
    label: "Feedback",
    icon: MessageSquare,
    requiresAuth: true,
  },
];

type WorkspaceNavProps = {
  isAuthenticated: boolean;
  /** Renders the Action center; true only for users leading a class. */
  isClassAdmin?: boolean;
  /** Renders the Lecturer section; true only for verified lecturers. */
  isLecturer?: boolean;
  /** Icon-only rendering for the collapsed desktop sidebar. */
  compact?: boolean;
  /** Menampilkan section University Info (UNPAM/FTI). */
  showUniversityInfo?: boolean;
  /** Closes the mobile drawer after a link is followed. */
  onNavigate?: () => void;
};

/**
 * Student navigation.
 *
 * Class admins gain the leader section and management actions inside My
 * Classes. Platform and developer consoles deliberately have their own shells
 * and navigation; access is still enforced server-side on every console route.
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

  const items = [
    ...STUDY_ITEMS,
    ...(isClassAdmin ? LEADER_ITEMS : []),
    ...(isLecturer ? LECTURER_ITEMS : []),
    ...(showUniversityInfo ? UNIVERSITY_ITEMS : []),
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
          aria-label={compact ? item.label : undefined}
          title={compact ? item.label : undefined}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            compact && "justify-center px-2",
            isActive
              ? "bg-accent-soft text-accent font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <NavIcon
            Icon={item.icon}
            isActive={isActive}
          />
          <span className={cn("truncate", compact && "sr-only")}>
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <NavSection
        label="Study"
        compact={compact}
      >
        {STUDY_ITEMS.map(renderItem)}
      </NavSection>
      {isClassAdmin && isAuthenticated ? (
        <NavSection
          label="Class leader"
          compact={compact}
        >
          {LEADER_ITEMS.map(renderItem)}
        </NavSection>
      ) : null}
      {isLecturer && isAuthenticated ? (
        <NavSection
          label="Lecturer"
          compact={compact}
        >
          {LECTURER_ITEMS.map(renderItem)}
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

/**
 * Swaps the destination icon for a spinner while its navigation is pending,
 * so a click on a slow (force-dynamic) route reads as immediate feedback
 * instead of a frozen screen until the server responds.
 */
function NavIcon({ Icon, isActive }: { Icon: LucideIcon; isActive: boolean }) {
  const { pending } = useLinkStatus();

  if (pending && !isActive) {
    return (
      <Loader2
        aria-hidden="true"
        className="h-[18px] w-[18px] shrink-0 animate-spin"
      />
    );
  }

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
        <p className="text-muted-foreground px-3 text-[11px] font-medium tracking-[0.08em] uppercase">
          {label}
        </p>
      )}
      <ul className={cn("space-y-1", !compact && "mt-2")}>{children}</ul>
    </div>
  );
}
