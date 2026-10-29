import { Star } from "lucide-react";
import Link from "next/link";

import { NavLink } from "@/components/layout/nav-link";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";

export async function SiteHeader() {
  const session = isSupabaseConfigured() ? await getSessionUser() : null;
  const displayName = session?.profile?.display_name ?? "StarsTask member";

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="bg-accent text-accent-foreground flex h-8 w-8 items-center justify-center rounded-md">
            <Star
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>
          <span>StarsTask</span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 sm:flex"
        >
          <NavLink href="/assignments">Explore</NavLink>
          <NavLink href="/classes">Classes</NavLink>
          {session ? <NavLink href="/submit">Submit</NavLink> : null}
          {session ? (
            <NavLink href="/my-assignments">My assignments</NavLink>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {session ? (
            <UserMenu
              displayName={displayName}
              avatarUrl={session.profile?.avatar_url ?? null}
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

      <nav
        aria-label="Primary mobile"
        className="border-border flex items-center gap-1 overflow-x-auto border-t px-4 py-2 sm:hidden"
      >
        <NavLink href="/assignments">Explore</NavLink>
        <NavLink href="/classes">Classes</NavLink>
        {session ? <NavLink href="/submit">Submit</NavLink> : null}
        {session ? <NavLink href="/my-assignments">Mine</NavLink> : null}
      </nav>
    </header>
  );
}
