import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { WorkspaceTopbar } from "@/components/layout/workspace-topbar";
import { isUnpamPluginEnabled, isUnpamUniversity } from "@/features/plugins/unpam/config";
import { isDeveloperEmail } from "@/lib/auth/developer";
import { getSessionUser } from "@/lib/auth/session";
import { isPlatformAdmin, isClassAdminAnywhere } from "@/lib/db/classes";
import { countUnreadNotifications } from "@/lib/db/notifications";
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
  // Sidebar hanya tampil bila plugin aktif (env) DAN profil menunjuk UNPAM.
  const showUniversityInfo =
    isUnpamPluginEnabled() && isUnpamUniversity(session?.profile?.university);
  // These lookups are independent, so they share one round-trip window instead
  // of adding three sequential waits to every workspace navigation.
  const [platformAdmin, classAdmin, unreadNotificationCount] =
    await Promise.all([
      // Admin navigation is cosmetic only; every admin route re-checks the role.
      session ? isPlatformAdmin() : Promise.resolve(false),
      session ? isClassAdminAnywhere(session.user.id) : Promise.resolve(false),
      // A bell badge is presentation only; a count failure must not take the
      // whole workspace down.
      session ? countUnreadNotifications().catch(() => 0) : Promise.resolve(0),
    ]);
  // Same principle: the allowlist check here only decides whether the console
  // link is rendered; /developer itself re-verifies the session email.
  const developer = session ? isDeveloperEmail(session.user.email) : false;

  return (
    <div className="bg-background lg:flex lg:min-h-dvh">
      <WorkspaceSidebar
        isAuthenticated={isAuthenticated}
        isClassAdmin={classAdmin}
        displayName={displayName}
        email={session?.user.email ?? null}
        avatarUrl={session?.profile?.avatar_url ?? null}
        showUniversityInfo={showUniversityInfo}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopbar
          isAuthenticated={isAuthenticated}
          isPlatformAdmin={platformAdmin}
          isDeveloper={developer}
          isClassAdmin={classAdmin}
          displayName={displayName}
          avatarUrl={session?.profile?.avatar_url ?? null}
          unreadNotificationCount={unreadNotificationCount}
        />
        <main
          id="main-content"
          // Bottom padding keeps the last row clear of the fixed mobile tabs,
          // including the device safe area on notched phones.
          className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          {children}
        </main>
      </div>

      {isAuthenticated ? <MobileTabBar /> : null}
    </div>
  );
}
