import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FaqSection } from "@/components/landing/faq-section";
import { FeatureStrip } from "@/components/landing/feature-strip";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingHero } from "@/components/landing/landing-hero";
import { MissionSection } from "@/components/landing/mission-section";
import { SubjectGrid } from "@/components/landing/subject-grid";
import { ValueSection } from "@/components/landing/value-section";
import { SetupNotice } from "@/components/layout/setup-notice";
import { resolveSignedInHomePath } from "@/lib/auth/developer";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";

export const metadata: Metadata = {
  title: { absolute: "StarsTask — Find. Understand. Contribute." },
  description:
    "StarsTask is a shared archive of university assignment briefs. Learn what the platform is, how contributions work, and why students publish their briefs.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const configured = isSupabaseConfigured();

  // The landing page is for visitors. Signed-in users belong in their home
  // area — the developer console for allowlisted developers, the workspace for
  // everyone else — and the header logo takes them there too.
  if (configured) {
    const session = await getSessionUser();

    if (session) {
      redirect(resolveSignedInHomePath(session.user.email));
    }
  }

  return (
    <div>
      <LandingHero />
      <FeatureStrip />

      {!configured ? (
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SetupNotice />
        </div>
      ) : null}

      <ValueSection />
      <HowItWorks />
      <SubjectGrid />
      <MissionSection />
      <FaqSection />
    </div>
  );
}
