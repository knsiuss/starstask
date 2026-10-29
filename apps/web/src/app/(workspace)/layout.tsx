import type { ReactNode } from "react";

import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { WorkspaceTopbar } from "@/components/layout/workspace-topbar";
import { getSessionUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = isSupabaseConfigured() ? await getSessionUser() : null;
  const isAuthenticated = session !== null;
  const displayName = session?.profile?.display_name ?? "StarsTask member";
  // Admin navigation is cosmetic only; every admin route re-checks the role.
  const platformAdmin = session ? await isPlatformAdmin() : false;

  return (
    <div className="bg-background lg:flex lg:min-h-dvh">
      <WorkspaceSidebar
        isAuthenticated={isAuthenticated}
        isPlatformAdmin={platformAdmin}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopbar
          isAuthenticated={isAuthenticated}
          isPlatformAdmin={platformAdmin}
          displayName={displayName}
          avatarUrl={session?.profile?.avatar_url ?? null}
        />
        <main
          id="main-content"
          className="flex-1"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
