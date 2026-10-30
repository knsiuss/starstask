"use client";

import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Flag,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const ADMIN_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  {
    href: "/admin/applications",
    label: "Class applications",
    icon: ClipboardList,
  },
  { href: "/admin/classes", label: "Classes", icon: GraduationCap },
  { href: "/admin/assignments", label: "Assignments", icon: FileText },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  {
    href: "/admin/verifications",
    label: "Verifications",
    icon: ShieldCheck,
  },
];

/**
 * Section navigation for the platform console.
 *
 * Only features that exist are listed. The longest matching href wins so
 * `/admin/verifications/[id]` keeps Verifications highlighted rather than
 * falling back to Overview.
 */
export function AdminNav() {
  const pathname = usePathname();

  const activeHref = ADMIN_ITEMS.map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((left, right) => right.length - left.length)[0];

  return (
    <nav aria-label="Platform administration">
      <p className="text-muted-foreground px-3 text-[11px] font-medium tracking-[0.08em] uppercase">
        Platform console
      </p>

      <ul className="mt-2 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {ADMIN_ITEMS.map((item) => {
          const isActive = item.href === activeHref;

          return (
            <li
              key={item.href}
              className="shrink-0"
            >
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-accent-soft text-accent font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon
                  aria-hidden="true"
                  className="h-[18px] w-[18px] shrink-0"
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-border mt-4 hidden border-t pt-3 lg:block">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-4 w-4"
          />
          Back to workspace
        </Link>
      </div>
    </nav>
  );
}
