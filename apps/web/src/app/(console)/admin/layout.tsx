import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { ConsoleShell } from "@/components/console/console-shell";
import { isDeveloperEmail } from "@/lib/auth/developer";
import { getSessionUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const dynamic = "force-dynamic";

/**
 * Platform console shell.
 *
 * This route group is deliberately outside `(workspace)`: an operator sees the
 * admin navigation, not the student sidebar with an admin link squeezed in.
 * Authorization is enforced here and re-checked by every page that reads admin
 * data, so a direct request cannot render the console just because navigation
 * was hidden. RLS still governs the rows each query returns.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <>{children}</>;
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/admin"));
  }

  if (session.profile && !session.profile.onboarded_at) {
    redirect(`/onboarding?next=${encodeURIComponent("/admin")}`);
  }

  if (!(await isPlatformAdmin())) {
    notFound();
  }

  return (
    <ConsoleShell
      label="Platform console"
      nav={<AdminNav />}
      displayName={session.profile?.display_name ?? "StarsTask member"}
      avatarUrl={session.profile?.avatar_url ?? null}
      isPlatformAdmin
      isDeveloper={isDeveloperEmail(session.user.email)}
    >
      {children}
    </ConsoleShell>
  );
}
