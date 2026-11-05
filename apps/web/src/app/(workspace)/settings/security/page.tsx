import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { SecurityPrivacyPanel } from "@/components/messages/security-privacy-panel";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Security & Privacy",
  description: "Manage message encryption and device keys.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Security &amp; Privacy
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/settings/security"));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Security &amp; Privacy
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Your messages stay private by default. This page holds everything
          about how they are protected — the chat itself stays clean.
        </p>
      </header>

      <div className="mt-8">
        <SecurityPrivacyPanel />
      </div>
    </div>
  );
}
