import {
  Building2,
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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  requiresAuth?: boolean;
};

export const STUDY_ITEMS: NavItem[] = [
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
export const LEADER_ITEMS: NavItem[] = [
  {
    href: "/app/actions",
    label: "Action center",
    icon: ListChecks,
    requiresAuth: true,
  },
];

/**
 * A verified lecturer gets a teaching-first shell: the same URLs, reordered so
 * the work waiting on them comes before their own studies. The flag is
 * cosmetic; every destination re-checks the lecturer role server-side.
 */
export const TEACHING_ITEMS: NavItem[] = [
  {
    href: "/app",
    label: "Teaching home",
    icon: LayoutDashboard,
    requiresAuth: true,
  },
  {
    href: "/app/actions",
    label: "Action center",
    icon: ListChecks,
    requiresAuth: true,
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: UserCheck,
    requiresAuth: true,
  },
  {
    href: "/leave-requests",
    label: "Absence requests",
    icon: ClipboardList,
    requiresAuth: true,
  },
];

/** Student-only destinations, used to keep the Study list free of duplicates. */
export const LEARNING_ITEMS: NavItem[] = STUDY_ITEMS.filter(
  (item) =>
    item.href !== "/app" &&
    item.href !== "/attendance" &&
    item.href !== "/leave-requests",
);

/**
 * University Info hanya muncul untuk pengguna yang terhubung ke kampus
 * dengan plugin aktif (mis. UNPAM). Flag dari server/layout; default false
 * berarti menu tidak dirender sama sekali.
 */
export const UNIVERSITY_ITEMS: NavItem[] = [
  {
    href: "/university-info",
    label: "University Info",
    icon: Building2,
  },
];

export const ACCOUNT_ITEMS: NavItem[] = [
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

/**
 * Pick the longest matching route prefix so nested pages (e.g. `/app/actions`)
 * do not highlight both their parent (`/app`) and themselves.
 */
export function getActiveNavHref(
  pathname: string,
  hrefs: string[],
): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((left, right) => right.length - left.length)[0];
}
