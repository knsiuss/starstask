import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ArchivePillars } from "@/components/landing/archive-pillars";
import { ClosingCta } from "@/components/landing/closing-cta";
import { FaqSection } from "@/components/landing/faq-section";
import { LandingHero } from "@/components/landing/landing-hero";
import { SetupNotice } from "@/components/layout/setup-notice";
import { resolveSignedInHomePath } from "@/lib/auth/developer";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";

export const metadata: Metadata = {
  title: { absolute: "StarsTask — University Assignment Archive" },
  description:
    "Search real course assignment briefs, deadlines, and starter files before you start.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const configured = isSupabaseConfigured();

  if (configured) {
    const session = await getSessionUser();

    if (session) {
      redirect(resolveSignedInHomePath(session.user.email));
    }
  }

  return (
    <div>
      <LandingHero />

      {!configured ? (
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SetupNotice />
        </div>
      ) : null}

      <ArchivePillars />
      <FaqSection />
      <ClosingCta />
    </div>
  );
}
