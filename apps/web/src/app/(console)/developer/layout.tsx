import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ConsoleShell } from "@/components/console/console-shell";
import { DeveloperAccessDenied } from "@/components/developer/developer-access-denied";
import { DeveloperNav } from "@/components/developer/developer-nav";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import { isPlatformAdmin } from "@/lib/db/classes";

export const metadata: Metadata = {
  title: "Developer console",
  description: "Internal operational console for StarsTask.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Developer console shell.
 *
 * Like the platform console, this lives outside `(workspace)` so the student
 * navigation never doubles as operator navigation. Access still comes only from
 * the session email allowlist, never from an application role.
 */
export default async function DeveloperLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await requireDeveloperPageAccess("/developer");

  if (access.status !== "allowed") {
    return (
      <DeveloperAccessDenied
        status={access.status === "unconfigured" ? "unconfigured" : "denied"}
      />
    );
  }

  const session = access.session;

  if (session.profile && !session.profile.onboarded_at) {
    redirect(`/onboarding?next=${encodeURIComponent("/developer")}`);
  }

  return (
    <ConsoleShell
      label="Developer console"
      nav={<DeveloperNav />}
      displayName={session.profile?.display_name ?? "StarsTask member"}
      avatarUrl={session.profile?.avatar_url ?? null}
      isPlatformAdmin={await isPlatformAdmin()}
      isDeveloper
    >
      {children}
    </ConsoleShell>
  );
}
