import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { AdminProfileOverview } from "@/components/profile/admin-profile-overview";
import { ClassAdminApplyPanel } from "@/components/profile/class-admin-apply-panel";
import { ProfileAcademic } from "@/components/profile/profile-academic";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { ProfileSection } from "@/components/profile/profile-section";
import type { GrantableClass } from "@/components/verification/representative-grant-form";
import { getSessionUser } from "@/lib/auth/session";
import { isPlatformAdmin, listMyClasses } from "@/lib/db/classes";
import { getMyProfile } from "@/lib/db/profiles";
import { listMyRepresentativeClassIds } from "@/lib/db/verification";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Profile settings",
  description: "Manage your StarsTask profile and account details.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10";

export default async function ProfileSettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <h1 className="text-2xl font-semibold tracking-tight">
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
      <div className={pageContainer}>
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

  const [classes, representativeClassIds] = await Promise.all([
    listMyClasses(session.user.id),
    listMyRepresentativeClassIds(session.user.id),
  ]);

  const representedClasses = new Set(representativeClassIds);

  // Any member of an active class can claim admin access directly — no
  // verification request, evidence, or approval. The server enforces the
  // 5-per-class cap.
  const availableClasses: GrantableClass[] = classes
    .filter(
      (item) =>
        item.status === "active" && !representedClasses.has(item.id),
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      semester: item.semester,
      academicYear: item.academic_year,
    }));

  const adminAccessClasses = classes.filter((item) =>
    representedClasses.has(item.id),
  );

  return (
    <div className={pageContainer}>
      <ProfileEditor
        fullName={profile?.fullName ?? ""}
        nickname={profile?.nickname ?? session.profile?.display_name ?? ""}
        bio={profile?.bio ?? ""}
        email={session.user.email ?? null}
        avatarUrl={profile?.avatarUrl ?? session.profile?.avatar_url ?? null}
        memberSince={
          session.user.created_at ? formatDate(session.user.created_at) : null
        }
        activeClassCount={
          classes.filter((item) => item.status === "active").length
        }
      >
        <ProfileAcademic
          nim={profile?.nim ?? null}
          university={profile?.university ?? null}
          declaredClassName={profile?.declaredClassName ?? null}
          classes={classes.map((item) => ({
            id: item.id,
            slug: item.slug,
            name: item.name,
            semester: item.semester,
            academic_year: item.academic_year,
            status: item.status,
          }))}
        />

        <ProfileSection
          id="class-admin"
          title="Class admin"
          description="Any member of an active class can claim admin access right away — up to 5 per class. No evidence or approval needed; the class decides who steps up."
        >
          <div className="px-5 py-4">
            <h3 className="text-foreground text-sm font-medium">
              Class admin access
            </h3>
            {adminAccessClasses.length === 0 ? (
              <p className="text-muted-foreground mt-1 text-sm">
                You do not administer any class yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {adminAccessClasses.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline gap-x-2"
                  >
                    <Link
                      href={`/dashboard/classes/${item.slug}/manage`}
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      {item.name}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {item.semester} · {item.academic_year}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {requests.length > 0 ? (
            <div className="border-border border-t px-5 py-4">
              <h3 className="text-foreground text-sm font-medium">Requests</h3>

              <div className="mt-3 grid gap-3">
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
            </div>
          ) : null}

          <div className="border-border border-t px-5 py-4">
            {liveClassIds.size > 0 ? (
              <Alert
                variant="info"
                className="mb-3"
              >
                A request is already in review. You cannot file a second one for
                the same class until it is decided.
              </Alert>
            ) : null}

            <ClassAdminApplyPanel classes={availableClasses} />
          </div>
        </ProfileSection>
      </ProfileEditor>
    </div>
  );
}
