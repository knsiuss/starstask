import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { HeaderSignIn } from "@/components/layout/header-sign-in";
import { NavLink } from "@/components/layout/nav-link";
import { SiteMobileNav } from "@/components/layout/site-mobile-nav";
import { SITE_LINKS } from "@/components/layout/site-nav-links";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { isDeveloperEmail } from "@/lib/auth/developer";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";

export async function SiteHeader() {
  const configured = isSupabaseConfigured();
  const session = configured ? await getSessionUser() : null;
  const displayName = session?.profile?.display_name ?? "StarsTask member";

  return (
    <header className="border-border bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-15 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <SiteMobileNav isAuthenticated={Boolean(session)} />
            <Link
              href={session ? "/app" : "/"}
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <BrandMark size={28} />
              <span>StarsTask</span>
            </Link>
          </div>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 lg:flex"
          >
            {SITE_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

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
                className={configured ? "sm:hidden" : undefined}
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
