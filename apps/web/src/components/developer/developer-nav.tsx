"use client";

import {
  ArrowLeft,
  Blocks,
  Database,
  Gauge,
  ScrollText,
  ShieldAlert,
  Siren,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

type DeveloperNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const DEVELOPER_ITEMS: DeveloperNavItem[] = [
  { href: "/developer", label: "Overview", icon: Gauge },
  { href: "/developer/logs", label: "Logs", icon: ScrollText },
  { href: "/developer/security", label: "Security", icon: ShieldAlert },
  { href: "/developer/database", label: "Database", icon: Database },
  { href: "/developer/users", label: "Users", icon: Users },
  { href: "/developer/integrations", label: "Integrations", icon: Blocks },
  { href: "/developer/incidents", label: "Incidents", icon: Siren },
];

/**
 * Section navigation for the internal developer console.
 *
 * The allowlist is cosmetic here; every /developer route re-verifies the
 * session email through `requireDeveloperPageAccess`.
 */
export function DeveloperNav() {
  const pathname = usePathname();

  const activeHref = DEVELOPER_ITEMS.map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((left, right) => right.length - left.length)[0];

  return (
    <nav aria-label="Developer console">
      <p className="text-muted-foreground px-3 text-[11px] font-medium tracking-[0.08em] uppercase">
        Developer console
      </p>

      <ul className="mt-2 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {DEVELOPER_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/developer"
              ? pathname === item.href
              : pathname.startsWith(`${item.href}/`));

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
