import { Bell } from "lucide-react";
import Link from "next/link";

import { BrandLink } from "@/components/layout/brand-link";
import { GlobalSearch } from "@/components/layout/global-search";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";

type WorkspaceTopbarProps = {
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isDeveloper: boolean;
  isClassAdmin: boolean;
  displayName: string;
  avatarUrl: string | null;
  unreadNotificationCount: number;
};

export function WorkspaceTopbar({
  isAuthenticated,
  isPlatformAdmin,
  isDeveloper,
  isClassAdmin,
  displayName,
  avatarUrl,
  unreadNotificationCount,
}: WorkspaceTopbarProps) {
  return (
    <header className="border-border bg-surface/90 sticky top-0 z-30 border-b backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNav
          isAuthenticated={isAuthenticated}
          isClassAdmin={isClassAdmin}
        />
        <BrandLink className="lg:hidden" />

        <div className="hidden min-w-0 flex-1 sm:block">
          <GlobalSearch />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link
              href="/notifications"
              aria-label={
                unreadNotificationCount > 0
                  ? `Notifications, ${unreadNotificationCount} unread`
                  : "Notifications"
              }
              className="border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Bell
                aria-hidden="true"
                className="h-5 w-5"
              />
              {unreadNotificationCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="bg-accent text-accent-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold"
                >
                  {unreadNotificationCount > 99
                    ? "99+"
                    : unreadNotificationCount}
                </span>
              ) : null}
            </Link>
          ) : null}

          {isAuthenticated ? (
            <UserMenu
              displayName={displayName}
              avatarUrl={avatarUrl}
              isPlatformAdmin={isPlatformAdmin}
              isDeveloper={isDeveloper}
            />
          ) : (
            <Button
              asChild
              size="sm"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
