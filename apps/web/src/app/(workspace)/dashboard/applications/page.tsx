import { ArrowRight, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/classes/status-badge";
import { ClassApplicationForm } from "@/components/forms/class-application-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { listMyApplications } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class applications",
  description: "Apply to create a class and follow your application status.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard/applications"));
  }

  const applications = await listMyApplications(session.user.id);
  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Class applications
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
          Any signed-in user may apply to create a class. A platform admin
          reviews the proposed class before it becomes active, and they
          separately decide whether the applicant becomes its class admin.
        </p>
      </header>

      <section
        aria-labelledby="application-list"
        className="mt-8"
      >
        <div className="flex items-center gap-2.5">
          <h2
            id="application-list"
            className="text-lg font-semibold tracking-tight"
          >
            My applications
          </h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {applications.length}
          </span>
        </div>

        {applications.length === 0 ? (
          <div className="border-border bg-subtle mt-4 rounded-lg border border-dashed px-6 py-12 text-center">
            <h3 className="text-base font-semibold">No applications yet</h3>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
              Use the form below to propose a class. Nothing is created until a
              platform admin approves it.
            </p>
          </div>
        ) : (
          <ul className="border-border divide-border mt-4 divide-y rounded-lg border">
            {applications.map((application) => (
              <li
                key={application.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/applications/${application.id}`}
                    className="hover:text-accent font-medium underline-offset-4 hover:underline"
                  >
                    {application.proposed_name}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {application.course_name} · {application.semester}{" "}
                    {application.academic_year} ·{" "}
                    {formatDate(application.created_at)}
                  </p>
                  {application.status === "rejected" &&
                  application.decision_note ? (
                    <p className="text-danger mt-1 max-w-xl text-xs">
                      Reviewer note: {application.decision_note}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={application.status} />
                  <Link
                    href={`/dashboard/applications/${application.id}`}
                    className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    Open
                    <ArrowRight
                      aria-hidden="true"
                      className="h-3 w-3"
                    />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="new-application"
        className="border-border bg-surface mt-10 rounded-xl border p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
            <PlusCircle
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>
          <div>
            <h2
              id="new-application"
              className="text-lg font-semibold tracking-tight"
            >
              Apply to create a class
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Duplicate open applications for the same class link are blocked. A
              rejected application can be corrected and resubmitted.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <ClassApplicationForm
            mode="create"
            initialValues={{
              proposedName: "",
              proposedSlug: "",
              courseName: "",
              institution: "",
              lecturerName: "",
              semester: "",
              academicYear: `${year}/${year + 1}`,
              description: "",
              reason: "",
              supportingInfo: "",
            }}
          />
        </div>
      </section>

      <p className="text-muted-foreground mt-6 text-xs">
        Need an existing class instead?{" "}
        <Button
          asChild
          variant="link"
          className="h-auto p-0 text-xs"
        >
          <Link href="/classes">Browse approved classes</Link>
        </Button>
      </p>
    </div>
  );
}
