import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SetupNotice } from "@/components/layout/setup-notice";
import { UniversitySelector } from "@/components/university/university-selector";
import { getSessionUser } from "@/lib/auth/session";
import {
  getMyHomeMembership,
  listMyEnrollments,
  listOpenOfferingsForUniversity,
} from "@/lib/db/course-offerings";
import { listActiveUniversities } from "@/lib/db/universities";
import { isSupabaseConfigured } from "@/lib/env/public";
import { getIdentityContext } from "@/lib/identity/get-identity-context";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "University & academic identity",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UniversityPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/university"));
  }

  const resolved = await getIdentityContext();
  const universities = await listActiveUniversities();

  if (!resolved.authenticated) {
    redirect(buildLoginPath("/university"));
  }

  const { context } = resolved;
  const activeContext = context.status === "active" ? context : null;
  const universityId = activeContext?.university.id ?? null;

  const [homeMembership, enrollments, openOfferings] = await Promise.all([
    activeContext ? getMyHomeMembership() : Promise.resolve(null),
    activeContext ? listMyEnrollments() : Promise.resolve([]),
    universityId
      ? listOpenOfferingsForUniversity(universityId)
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        University &amp; academic identity
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Your university membership, home class, and course enrollments.
      </p>

      <div className="mt-6">
        <IdentityStatusCard context={context} />
      </div>

      {activeContext ? (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Academic identity</CardTitle>
              <CardDescription>
                Imported by your university operator via the platform.
              </CardDescription>
            </CardHeader>
            <dl className="space-y-2 px-6 pb-6 text-sm">
              <Row label="Student ID">
                {activeContext.identity?.studentId ??
                  activeContext.membership.studentId ?? <MissingIdentityNote />}
              </Row>
              <Row label="Entry year">
                {activeContext.identity?.entryYear ??
                  activeContext.membership.entryYear ??
                  "â€”"}
              </Row>
              <Row label="Persona status">
                <Badge variant="neutral">
                  {activeContext.membership.status}
                </Badge>
              </Row>
              <Row label="Identity status">
                {activeContext.identity ? (
                  <Badge variant="neutral">
                    {activeContext.identity.status}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">
                    Not provisioned yet â€” ask your operator.
                  </span>
                )}
              </Row>
              <Row label="Role">{activeContext.membership.role}</Row>
              <Row label="Timezone">
                {activeContext.university.timezone ?? "â€”"}
              </Row>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Home class</CardTitle>
              <CardDescription>
                One home class per university; it cannot be changed here.
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-sm">
              {homeMembership ? (
                <>
                  <p className="font-medium">{homeMembership.className}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Joined{" "}
                    {new Date(homeMembership.joinedAt).toLocaleDateString()}
                  </p>
                  <Link
                    href={`/classes/${homeMembership.classSlug}`}
                    className="text-accent mt-3 inline-block hover:underline"
                  >
                    View class
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground">
                  No home class is assigned to your identity yet.
                </p>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {activeContext ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>My enrollments</CardTitle>
            <CardDescription>
              Retakes are isolated to the offering; they never touch your home
              class.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            {enrollments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No enrollments yet. Your class administrator enrolls you, or an
                invitation is redeemed once the invite policy is published.
              </p>
            ) : (
              <ul className="divide-border divide-y text-sm">
                {enrollments.map((enrollment) => (
                  <li
                    key={enrollment.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>
                      <span className="font-medium">
                        {enrollment.courseCode
                          ? `${enrollment.courseCode} Â· `
                          : ""}
                        {enrollment.courseName}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {enrollment.source.replace("_", " ")} Â· enrolled{" "}
                        {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </span>
                    </span>
                    <Badge variant="neutral">{enrollment.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      {activeContext ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              Open offerings at {activeContext.university.name}
            </CardTitle>
            <CardDescription>
              Discovery only â€” enrollment stays with your class administrator.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            {openOfferings.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No open offerings right now.
              </p>
            ) : (
              <ul className="divide-border divide-y text-sm">
                {openOfferings.map((offering) => (
                  <li
                    key={offering.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>
                      <span className="font-medium">
                        {offering.courseCode
                          ? `${offering.courseCode} Â· `
                          : ""}
                        {offering.courseName}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {offering.lecturerName
                          ? `Lecturer: ${offering.lecturerName}`
                          : "Lecturer to be announced"}
                      </span>
                    </span>
                    <Badge variant="neutral">open</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            {activeContext ? "Active universities" : "Find your university"}
          </CardTitle>
          <CardDescription>
            Only active universities are listed. Registered or suspended
            universities are not selectable until the platform activates them.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <UniversitySelector
            universities={universities}
            currentUniversityId={universityId}
          />
        </div>
      </Card>
    </div>
  );
}

type UniversityContext = NonNullable<
  Awaited<ReturnType<typeof getIdentityContext>> extends infer T
    ? T extends { authenticated: true; context: infer C }
      ? C
      : never
    : never
>;

function IdentityStatusCard({ context }: { context: UniversityContext }) {
  switch (context.status) {
    case "active":
      return (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle>Linked to {context.university.name}</CardTitle>
            <CardDescription>
              Your membership is active. Academic features are available
              according to your class and permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    case "missing_profile":
      return (
        <StatusNotice
          title="Finish your profile first"
          body="Your account has no profile yet. Complete onboarding, then come back to link your university."
          cta={{ href: "/onboarding", label: "Complete onboarding" }}
        />
      );
    case "no_membership":
      return (
        <StatusNotice
          title="Not linked to a university yet"
          body="Your account is not linked to any university. Find yours below and ask its operator to grant you a membership â€” it is never created automatically."
        />
      );
    case "multiple_active_memberships":
      return (
        <StatusNotice
          title="Multiple university memberships"
          body="Your account holds more than one active membership. StarsTask does not pick one for you â€” ask the platform operator to resolve the duplicate before academic features can load."
        />
      );
    case "no_active_membership":
      return (
        <StatusNotice
          title="No active membership"
          body="Your memberships are pending, suspended, or graduated. Suspended memberships can only be reactivated by the platform operator."
        />
      );
    case "inactive_university":
      return (
        <StatusNotice
          title="University not active"
          body="Your university is not currently active on StarsTask, so academic data is unavailable. Please contact your university operator."
        />
      );
  }
}

function StatusNotice({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      {cta ? (
        <div className="px-6 pb-6">
          <Link
            href={cta.href}
            className="text-accent text-sm hover:underline"
          >
            {cta.label}
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

function MissingIdentityNote() {
  return (
    <span className="text-muted-foreground text-xs">
      missing â€” ask your operator to provision it
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground w-32 shrink-0">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
