import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { WorkspaceTopbar } from "@/components/layout/workspace-topbar";
import { isDeveloperEmail } from "@/lib/auth/developer";
import { getSessionUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = isSupabaseConfigured() ? await getSessionUser() : null;

  // Onboarding is a prerequisite for the workspace. The /onboarding route lives
  // outside this layout, so this cannot loop. A missing profile row means the
  // provisioning trigger is not installed; that is a setup problem, not an
  // onboarding one, so it is left alone rather than trapped in a redirect.
  if (session?.profile && !session.profile.onboarded_at) {
    redirect("/onboarding");
  }

  const isAuthenticated = session !== null;
  const displayName = session?.profile?.display_name ?? "StarsTask member";
  // Admin navigation is cosmetic only; every admin route re-checks the role.
  const platformAdmin = session ? await isPlatformAdmin() : false;
  // Same principle: the allowlist check here only decides whether the console
  // link is rendered; /developer itself re-verifies the session email.
  const developer = session ? isDeveloperEmail(session.user.email) : false;

  return (
    <div className="bg-background lg:flex lg:min-h-dvh">
      <WorkspaceSidebar isAuthenticated={isAuthenticated} />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopbar
          isAuthenticated={isAuthenticated}
          isPlatformAdmin={platformAdmin}
          isDeveloper={developer}
          displayName={displayName}
          avatarUrl={session?.profile?.avatar_url ?? null}
        />
        <main
          id="main-content"
          // Bottom padding keeps the last row clear of the fixed mobile tabs.
          className="flex-1 pb-16 lg:pb-0"
        >
          {children}
        </main>
      </div>

      {isAuthenticated ? <MobileTabBar /> : null}
    </div>
  );
}
