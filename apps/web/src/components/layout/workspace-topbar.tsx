import { Bell } from "lucide-react";
import Link from "next/link";

import { BrandLink } from "@/components/layout/brand-link";
import { GlobalSearch } from "@/components/layout/global-search";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";

type WorkspaceTopbarProps = {
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isDeveloper: boolean;
  displayName: string;
  avatarUrl: string | null;
};

export function WorkspaceTopbar({
  isAuthenticated,
  isPlatformAdmin,
  isDeveloper,
  displayName,
  avatarUrl,
}: WorkspaceTopbarProps) {
  return (
    <header className="border-border bg-surface/90 sticky top-0 z-30 border-b backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNav isAuthenticated={isAuthenticated} />
        <BrandLink className="lg:hidden" />

        <div className="hidden min-w-0 flex-1 sm:block">
          <GlobalSearch />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {isAuthenticated ? (
            <Link
              href="/settings/notifications"
              aria-label="Notification settings"
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent rounded-md p-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Bell
                aria-hidden="true"
                className="h-5 w-5"
              />
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
