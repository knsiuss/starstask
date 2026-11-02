import {
  BookOpen,
  FileText,
  LayoutDashboard,
  Mail,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export const MANAGE_TABS = [
  "overview",
  "courses",
  "members",
  "invites",
  "content",
  "settings",
] as const;

export type ManageTab = (typeof MANAGE_TABS)[number];

const MANAGE_TAB_ITEMS: readonly {
  tab: ManageTab;
  label: string;
  icon: LucideIcon;
}[] = [
  { tab: "overview", label: "Overview", icon: LayoutDashboard },
  { tab: "courses", label: "Courses", icon: BookOpen },
  { tab: "members", label: "Members", icon: Users },
  { tab: "invites", label: "Invites", icon: Mail },
  { tab: "content", label: "Content", icon: FileText },
  { tab: "settings", label: "Settings", icon: Settings },
];

export function isManageTab(value: string | undefined): value is ManageTab {
  return (
    value !== undefined && (MANAGE_TABS as readonly string[]).includes(value)
  );
}

export function manageTabHref(slug: string, tab: ManageTab): string {
  const base = `/dashboard/classes/${slug}/manage`;

  return tab === "overview" ? base : `${base}?tab=${tab}`;
}

type ManageClassTabsProps = {
  slug: string;
  activeTab: ManageTab;
};

/** Real links keep each management section server-rendered and shareable. */
export function ManageClassTabs({ slug, activeTab }: ManageClassTabsProps) {
  return (
    <nav
      aria-label="Manage sections"
      className="border-border mt-6 overflow-x-auto border-b"
    >
      <ul className="-mb-px flex min-w-max items-center gap-1">
        {MANAGE_TAB_ITEMS.map(({ tab, label, icon: Icon }) => {
          const isActive = tab === activeTab;

          return (
            <li key={tab}>
              <Link
                href={manageTabHref(slug, tab)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
