import {
  CalendarDays,
  ClipboardList,
  Info,
  Settings,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ClipboardPen } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type Action = {
  label: string;
  href: string;
  icon: LucideIcon;
  featured?: boolean;
};

type Props = {
  classSlug: string;
  canManage: boolean;
};

/**
 * Role-aware quick actions. Only destinations the current user's class role
 * can actually reach — the routes re-check authorization server-side.
 */
export function ClassQuickActions({ classSlug, canManage }: Props) {
  const base = `/dashboard/classes/${classSlug}`;

  const actions: Action[] = canManage
    ? [
        {
          label: "Create Assignment",
          href: `${base}/submit`,
          icon: ClipboardPen,
          featured: true,
        },
        {
          label: "Manage Members",
          href: `${base}/manage?tab=members`,
          icon: Users,
        },
        {
          label: "Set Schedule",
          href: `${base}?tab=schedule`,
          icon: CalendarDays,
        },
        {
          label: "Class Settings",
          href: `${base}/manage?tab=settings`,
          icon: Settings,
        },
        {
          label: "Export Report",
          href: `${base}/attendance`,
          icon: ClipboardList,
        },
        { label: "Class Info", href: `${base}?tab=info`, icon: Info },
      ]
    : [
        { label: "View Courses", href: `${base}/courses`, icon: ClipboardList },
        { label: "View Members", href: `${base}?tab=members`, icon: Users },
        {
          label: "View Schedule",
          href: `${base}?tab=schedule`,
          icon: CalendarDays,
        },
        {
          label: "Request Assignment Publication",
          href: `${base}/submit`,
          icon: UserPlus,
        },
        { label: "View Class Info", href: `${base}?tab=info`, icon: Info },
      ];

  return (
    <section
      aria-labelledby="class-quick-actions"
      className="border-border bg-surface rounded-xl border p-4 sm:p-5"
    >
      <h2
        id="class-quick-actions"
        className="text-foreground inline-flex items-center gap-2 text-base font-semibold tracking-tight"
      >
        <Zap
          aria-hidden="true"
          className="text-accent h-4.5 w-4.5"
        />
        Class Quick Actions
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {actions.map((action) => (
          <li key={action.label}>
            <Link
              href={action.href}
              className={cn(
                "flex h-full flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center text-xs font-medium transition-colors focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2",
                action.featured
                  ? "border-accent/30 bg-accent-soft text-accent hover:border-accent/50"
                  : "border-border text-muted-foreground hover:border-accent/30 hover:text-foreground",
              )}
            >
              <action.icon
                aria-hidden="true"
                className="h-5 w-5"
              />
              <span>{action.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
