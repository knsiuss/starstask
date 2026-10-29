"use client";

import {
  Compass,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Upload,
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
  { href: "/assignments", label: "Explore", icon: Compass },
  { href: "/classes", label: "Classes", icon: GraduationCap },
  { href: "/submit", label: "Submit", icon: Upload, requiresAuth: true },
  {
    href: "/my-assignments",
    label: "My submissions",
    icon: FileText,
    requiresAuth: true,
  },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Platform admin", icon: ShieldCheck },
];

const ACCOUNT_ITEMS: NavItem[] = [
  {
    href: "/settings/notifications",
    label: "Settings",
    icon: Settings,
    requiresAuth: true,
  },
];

type WorkspaceNavProps = {
  isAuthenticated: boolean;
  isPlatformAdmin?: boolean;
  /** Closes the mobile drawer after a link is followed. */
  onNavigate?: () => void;
};

export function WorkspaceNav({
  isAuthenticated,
  isPlatformAdmin = false,
  onNavigate,
}: WorkspaceNavProps) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    if (item.requiresAuth && !isAuthenticated) {
      return null;
    }

    const isActive =
      pathname === item.href || pathname.startsWith(`${item.href}/`);

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
      <NavSection label="Main">{MAIN_ITEMS.map(renderItem)}</NavSection>
      {isPlatformAdmin ? (
        <NavSection label="Platform">{ADMIN_ITEMS.map(renderItem)}</NavSection>
      ) : null}
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
