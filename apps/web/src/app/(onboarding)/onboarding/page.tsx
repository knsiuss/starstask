import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileOnboardingForm } from "@/components/profile/profile-onboarding-form";
import { getSessionUser } from "@/lib/auth/session";
import { getMyProfile } from "@/lib/db/profiles";
import { isSupabaseConfigured } from "@/lib/env/public";
import { safeRedirectPath } from "@/lib/security/redirect";

// The completion check must read the live session on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up your profile",
  description: "Finish setting up your StarsTask profile to continue.",
  robots: { index: false, follow: false },
};

type OnboardingPageProps = {
  searchParams: Promise<{ next?: string }>;
};

/**
 * Profile setup for a signed-in user whose profile is not complete yet.
 *
 * Every decision here is server-side: the session is verified, the completion
 * state comes from the database, and an already-complete profile never sees the
 * form. The `next` destination is reduced through `safeRedirectPath`.
 */
export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = await searchParams;
  const nextPath = safeRedirectPath(params.next, "/assignments");

  if (!isSupabaseConfigured()) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const session = await getSessionUser();

  if (!session) {
    const returnTo = `/onboarding?next=${encodeURIComponent(nextPath)}`;

    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  // A complete profile skips onboarding entirely.
  if (session.profile?.onboarded_at) {
    redirect(nextPath);
  }

  const profile = await getMyProfile();
  const googleName = session.profile?.display_name ?? "";

  return (
    <ProfileOnboardingForm
      nextPath={nextPath}
      initialValues={{
        fullName: profile?.fullName ?? googleName,
        nickname: profile?.nickname ?? googleName,
        nim: profile?.nim ?? "",
        university: profile?.university ?? "",
        className: profile?.declaredClassName ?? "",
        avatarUrl: session.profile?.avatar_url ?? null,
      }}
    />
  );
}
