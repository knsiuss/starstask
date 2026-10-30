import { Search, Star } from "lucide-react";
import Link from "next/link";

import { HeaderSignIn } from "@/components/layout/header-sign-in";
import { NavLink } from "@/components/layout/nav-link";
import { SiteMobileNav } from "@/components/layout/site-mobile-nav";
import { SITE_LINKS } from "@/components/layout/site-nav-links";
import { UserMenu } from "@/components/layout/user-menu";
import { isDeveloperEmail } from "@/lib/auth/developer";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";

export async function SiteHeader() {
  const configured = isSupabaseConfigured();
  const session = configured ? await getSessionUser() : null;
  const displayName = session?.profile?.display_name ?? "StarsTask member";

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <SiteMobileNav isAuthenticated={Boolean(session)} />

        <Link
          href={session ? "/dashboard" : "/"}
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
          className="hidden items-center gap-0.5 lg:flex"
        >
          {SITE_LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
            >
              {link.label}
            </NavLink>
          ))}
          {session ? (
            <NavLink href="/my-assignments">My assignments</NavLink>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
          >
            <Link
              href="/assignments"
              aria-label="Search assignments"
            >
              <Search
                aria-hidden="true"
                className="h-4 w-4"
              />
            </Link>
          </Button>

          {session ? (
            <UserMenu
              displayName={displayName}
              avatarUrl={session.profile?.avatar_url ?? null}
              isDeveloper={isDeveloperEmail(session.user.email)}
            />
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
              >
                <Link href="/login">Sign in</Link>
              </Button>
              {configured ? <HeaderSignIn /> : null}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
