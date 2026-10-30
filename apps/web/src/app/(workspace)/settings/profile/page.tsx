import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { AdminProfileOverview } from "@/components/profile/admin-profile-overview";
import { ProfileBioForm } from "@/components/profile/profile-bio-form";
import { Alert } from "@/components/ui/alert";
import { PositionForm } from "@/components/verification/position-form";
import {
  RepresentativeGrantForm,
  type GrantableClass,
} from "@/components/verification/representative-grant-form";
import { VerificationRequestCard } from "@/components/verification/verification-request-card";
import { getSessionUser } from "@/lib/auth/session";
import { isPlatformAdmin, listMyClasses } from "@/lib/db/classes";
import { getMyProfile } from "@/lib/db/profiles";
import {
  getMyDeclaredPosition,
  listMyRepresentativeClassIds,
  listMyVerificationRequests,
} from "@/lib/db/verification";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { getVerificationEvidenceViews } from "@/features/verification/evidence-service";

export const metadata: Metadata = {
  title: "Profile settings",
  description: "Manage your StarsTask profile and account details.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Profile settings
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/settings/profile"));
  }

  const [platformAdmin, profile] = await Promise.all([
    isPlatformAdmin(),
    getMyProfile(),
  ]);

  if (platformAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <AdminProfileOverview
          profile={profile}
          displayName={
            session.profile?.display_name ??
            profile?.nickname ??
            "Platform administrator"
          }
          email={session.user.email ?? null}
          avatarUrl={session.profile?.avatar_url ?? profile?.avatarUrl ?? null}
          memberSince={session.user.created_at ?? null}
        />
      </div>
    );
  }

  const [position, requests, classes, representativeClassIds] =
    await Promise.all([
      getMyDeclaredPosition(),
      listMyVerificationRequests(session.user.id),
      listMyClasses(session.user.id),
      listMyRepresentativeClassIds(session.user.id),
    ]);

  const evidenceEntries = await Promise.all(
    requests.map(
      async (request) =>
        [request.id, await getVerificationEvidenceViews(request.id)] as const,
    ),
  );
  const evidenceByRequest = new Map(evidenceEntries);

  const liveClassIds = new Set(
    requests
      .filter(
        (request) =>
          request.status === "pending" ||
          request.status === "needs_revision" ||
          request.status === "verified",
      )
      .map((request) => request.classId),
  );

  const representedClasses = new Set(representativeClassIds);

  const availableClasses: GrantableClass[] = classes
    .filter(
      (item) =>
        item.status === "active" &&
        !representedClasses.has(item.id) &&
        !liveClassIds.has(item.id),
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      semester: item.semester,
      academicYear: item.academic_year,
    }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Profile and verification
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Declare the position you hold. Verification review is temporarily
          disabled: as a class member you can claim representative access
          directly, up to 5 representatives per class.
        </p>
      </header>

      <div className="mt-8 space-y-8">
        <section aria-labelledby="public-profile-heading">
          <div className="mb-4">
            <h2
              id="public-profile-heading"
              className="text-xl font-semibold tracking-tight"
            >
              Public profile
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              Your nickname is already visible on class pages. Add a short bio
              so classmates know who they are working with.
            </p>
          </div>

          <ProfileBioForm initialBio={profile?.bio ?? ""} />
        </section>

        <PositionForm initialPosition={position} />

        <section aria-labelledby="verification-heading">
          <div className="mb-4">
            <h2
              id="verification-heading"
              className="text-xl font-semibold tracking-tight"
            >
              Class representative access
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              Verification review is temporarily disabled. Pick the class you
              represent to get class admin access for it right away; a class can
              have at most 5 representatives.
            </p>
          </div>

          <div className="space-y-4">
            {availableClasses.length === 0 ? (
              <Alert variant="info">
                There is no active class you can claim yet. Join a class first,
                then claim representative access here.
              </Alert>
            ) : (
              <RepresentativeGrantForm classes={availableClasses} />
            )}

            {requests.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No verification requests yet.
              </p>
            ) : (
              <div className="grid gap-4">
                {requests.map((request) => (
                  <VerificationRequestCard
                    key={request.id}
                    request={{
                      id: request.id,
                      className: request.className,
                      classSlug: request.classSlug,
                      status: request.status,
                      statement: request.statement,
                      submittedAt: request.submittedAt,
                      reviewedAt: request.reviewedAt,
                      reviewNote: request.reviewNote,
                      hasClassAdminAccess: request.hasClassAdminAccess,
                    }}
                    evidence={evidenceByRequest.get(request.id) ?? []}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <p className="text-muted-foreground mt-8 text-xs leading-relaxed">
        Evidence files are stored privately. They can be opened only by you and
        by platform admins reviewing your request, through short-lived links.
        Notifications never include document contents or file links.
      </p>
    </div>
  );
}
