import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { PostHogIdentify } from "@/components/analytics/posthog-identify";
import { DmKeySetup } from "@/components/messages/dm-key-setup";
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { WorkspaceTopbar } from "@/components/layout/workspace-topbar";
import { isUnpamPluginEnabled } from "@/features/plugins/unpam/config";
import { isUnpamMember } from "@/lib/db/plugins";
import { isBetaTester } from "@/lib/auth/beta";
import { isDeveloperEmail } from "@/lib/auth/developer";
import { getSessionUser } from "@/lib/auth/session";
import { isPlatformAdmin, isClassAdminAnywhere } from "@/lib/db/classes";
import { countUnreadNotifications } from "@/lib/db/notifications";
import { getWorkspaceContext } from "@/lib/db/workspace-context";
import { getMyProfile } from "@/lib/db/profiles";
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
  // Fast path: 1 RPC roundtrip for all layout context (20261158000000).
  // Falls back to the legacy parallel multi-query on error. The session
  // profile has no university (private, RPC-only), so when the Unpam
  // plugin is enabled the full profile is still loaded for its check.
  const context = session ? await getWorkspaceContext() : null;
  const needsFullProfile = isUnpamPluginEnabled();
  const [
    platformAdmin,
    classAdmin,
    unreadNotificationCount,
    myProfile,
    unpamMember,
    betaTester,
  ] = context
    ? [
        context.platformAdmin,
        context.classAdminAnywhere,
        context.unreadNotifications,
        needsFullProfile
          ? await getMyProfile().catch(() => session?.profile ?? null)
          : (session?.profile ?? null),
        false,
        context.betaTester,
      ]
    : await Promise.all([
        session ? isPlatformAdmin() : Promise.resolve(false),
        session
          ? isClassAdminAnywhere(session.user.id)
          : Promise.resolve(false),
        session
          ? countUnreadNotifications().catch(() => 0)
          : Promise.resolve(0),
        session ? getMyProfile().catch(() => null) : Promise.resolve(null),
        // isUnpamMember di-cache per-request; butuh profileUniversity dari getMyProfile,
        // jadi fallback teks dicek setelah profile ada — registry query tetap paralel via cache.
        Promise.resolve(false),
        session ? isBetaTester() : Promise.resolve(false),
      ]);
  const showUniversityInfo =
    isUnpamPluginEnabled() &&
    (unpamMember ||
      (await isUnpamMember(session?.user.id ?? null, myProfile?.university)));
  // Same principle: the allowlist check here only decides whether the console
  // link is rendered; /developer itself re-verifies the session email.
  const developer = session ? isDeveloperEmail(session.user.email) : false;

  return (
    <div className="bg-background lg:flex lg:min-h-dvh">
      <PostHogIdentify
        userId={session?.user.id ?? null}
        betaTester={betaTester}
      />
      {/* E2EE keys are generated on any workspace page, not just DM, so a
          peer who has logged in at all can receive messages immediately —
          like Instagram, no need to open the DM tab first. */}
      {isAuthenticated ? <DmKeySetup /> : null}
      <WorkspaceSidebar
        isAuthenticated={isAuthenticated}
        isClassAdmin={classAdmin}
        displayName={displayName}
        email={session?.user.email ?? null}
        avatarUrl={session?.profile?.avatar_url ?? null}
        showUniversityInfo={showUniversityInfo}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CommandPalette />
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
