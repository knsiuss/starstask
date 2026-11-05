import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Megaphone,
  ShieldCheck,
  Users,
  GraduationCap,
} from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AcademicYearForm } from "@/components/academic/academic-year-form";
import { ClassUnlinkedNotice } from "@/components/academic/unlinked-notice";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildUnitTree, flattenUnitTree } from "@/lib/academic/unit-tree";
import { hasAnyClassPermission } from "@/lib/authz/class-permission";
import { getSessionUser } from "@/lib/auth/session";
import {
  getClassAcademicLink,
  listAcademicUnits,
  listAcademicYears,
  listSemesters,
} from "@/lib/db/academic-structure";
import {
  countActiveEnrollments,
  listOfferingsForClass,
} from "@/lib/db/course-offerings";
import {
  getClassBySlug,
  getClassRole,
  isPlatformAdmin,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Academic administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AcademicHubProps = {
  params: Promise<{ slug: string }>;
};

export default async function AcademicHubPage({ params }: AcademicHubProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/app"));
  }

  const { slug } = await params;
  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const [role, platformAdmin, link, anyPermission] = await Promise.all([
    getClassRole(found.id),
    isPlatformAdmin(),
    getClassAcademicLink(found.id),
    hasAnyClassPermission(found.id),
  ]);

  if (!role.canManage && !anyPermission) {
    notFound();
  }

  const linked = Boolean(link?.universityId);
  const universityId = link?.universityId ?? null;

  const [units, years, semesters, offerings] = universityId
    ? await Promise.all([
        listAcademicUnits(universityId),
        listAcademicYears(universityId),
        listSemesters(universityId),
        listOfferingsForClass(found.id),
      ])
    : [[], [], [], []];

  const enrollmentCounts = await countActiveEnrollments(
    offerings.map((offering) => offering.id),
  );
  const currentYear = years.find((year) => year.isCurrent) ?? null;
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const semesterById = new Map(semesters.map((row) => [row.id, row]));
  const linkedUnit = link?.academicUnitId
    ? unitById.get(link.academicUnitId)
    : null;
  const linkedSemester = link?.semesterId
    ? semesterById.get(link.semesterId)
    : null;
  const linkedYear = link?.academicYearId
    ? (years.find((year) => year.id === link.academicYearId) ?? null)
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/app/classes/${found.slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to class
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <GraduationCap
          aria-hidden="true"
          className="text-accent h-7 w-7"
        />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Academic administration
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {found.name} — new multi-university domains (Phase 5I).
          </p>
        </div>
      </header>

      {!linked ? (
        <div className="mt-6">
          <ClassUnlinkedNotice />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Academic structure</CardTitle>
                <CardDescription>
                  Read-only view of the registry for this class.
                </CardDescription>
              </CardHeader>
              <dl className="space-y-2 px-6 pb-6 text-sm">
                <Row label="Unit">{linkedUnit?.name ?? "Not assigned"}</Row>
                <Row label="Academic year">
                  {linkedYear?.name ?? "Not assigned"}
                  {currentYear && linkedYear?.id !== currentYear.id ? (
                    <span className="text-muted-foreground">
                      {" "}
                      (current: {currentYear.name})
                    </span>
                  ) : null}
                </Row>
                <Row label="Semester">
                  {linkedSemester?.name ?? "Not assigned"}
                </Row>
                <Row label="Entry year">{link?.entryYear ?? "—"}</Row>
                <Row label="Class code">{link?.code ?? "—"}</Row>
                <Row label="Units in registry">{units.length}</Row>
                <Row label="Years in registry">{years.length}</Row>
                <Row label="Semesters in registry">{semesters.length}</Row>
              </dl>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Course offerings</CardTitle>
                <CardDescription>
                  Offerings linked to this class, with active enrollment counts.
                </CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                {offerings.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No offerings yet. Offerings are created by the platform
                    operator.
                  </p>
                ) : (
                  <ul className="divide-border divide-y text-sm">
                    {offerings.map((offering) => (
                      <li
                        key={offering.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <span>
                          <span className="font-medium">
                            {offering.courseCode
                              ? `${offering.courseCode} · `
                              : ""}
                            {offering.courseName}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {offering.lecturerName
                              ? `Lecturer: ${offering.lecturerName}`
                              : "Lecturer TBD"}
                            {" · "}
                            {enrollmentCounts.get(offering.id) ?? 0} active
                            enrollment(s)
                          </span>
                        </span>
                        <Badge variant="neutral">{offering.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Unit registry preview</CardTitle>
              <CardDescription>
                Parent-child view of the academic structure (depth-limited).
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6">
              {units.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No units registered yet. Units are created by the platform
                  operator.
                </p>
              ) : (
                <ul className="text-sm">
                  {flattenUnitTree(buildUnitTree(units), 2).map(
                    ({ node, depth }) => (
                      <li
                        key={node.id}
                        className="py-0.5"
                        style={{ paddingLeft: `${depth * 1.25}rem` }}
                      >
                        <span className="text-muted-foreground mr-1.5 text-xs uppercase">
                          {node.unitType}
                        </span>
                        {node.name}
                        <span className="text-muted-foreground ml-2 text-xs">
                          {node.status}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          </Card>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SubpageCard
              href={`/app/classes/${found.slug}/academic/admins`}
              icon={ShieldCheck}
              title="Class admins"
              description="Grant or revoke the 8 permission codes. Last admin is protected."
            />
            <SubpageCard
              href={`/app/classes/${found.slug}/academic/attendance`}
              icon={Users}
              title="Attendance"
              description="Normalized meetings, roster recording, and corrections ledger."
            />
            <SubpageCard
              href={`/app/classes/${found.slug}/academic/announcements`}
              icon={Megaphone}
              title="Announcements"
              description="Formal class-scoped announcements with read tracking."
            />
            <SubpageCard
              href={`/app/classes/${found.slug}/academic/grades`}
              icon={BookOpen}
              title="Grades (read-only)"
              description="Batch status and change history. Publishing stays disabled."
            />
            <SubpageCard
              href={`/app/classes/${found.slug}/academic/schedule`}
              icon={CalendarDays}
              title="Schedule model"
              description="Rules, instances, and exceptions with timezone-aware display."
            />
          </div>

          {platformAdmin && universityId ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Create academic year</CardTitle>
                <CardDescription>
                  Platform-admin operation. Marking a year as current archives
                  the previous flag on this university only.
                </CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <AcademicYearForm universityId={universityId} />
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground w-36 shrink-0">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SubpageCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-card hover:bg-muted group rounded-2xl border p-4 transition-colors"
    >
      <Icon
        aria-hidden="true"
        className="text-accent h-5 w-5"
      />
      <p className="mt-2 font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-snug">
        {description}
      </p>
    </Link>
  );
}
