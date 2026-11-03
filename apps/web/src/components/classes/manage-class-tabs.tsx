import {
  BookOpen,
  FileText,
  LayoutDashboard,
  Mail,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { TabStrip } from "@/components/ui/tab-strip";

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
    <TabStrip
      label="Manage sections"
      className="mt-6"
      items={MANAGE_TAB_ITEMS.map(({ tab, label, icon: Icon }) => ({
        href: manageTabHref(slug, tab),
        label,
        active: tab === activeTab,
        icon: (
          <Icon
            aria-hidden="true"
            className="h-4 w-4"
          />
        ),
      }))}
    />
  );
}
