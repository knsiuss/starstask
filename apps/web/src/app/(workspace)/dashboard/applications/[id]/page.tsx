import { ArrowLeft, CheckCircle2, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { StatusBadge } from "@/components/classes/status-badge";
import { WithdrawApplicationButton } from "@/components/classes/withdraw-application-button";
import { ClassApplicationForm } from "@/components/forms/class-application-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import {
  getApplicationById,
  getClassById,
  listApplicationReviews,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { classApplicationIdSchema } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class application",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ApplicationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function ApplicationPage({
  params,
  searchParams,
}: ApplicationPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard/applications"));
  }

  const { id } = await params;
  const parsed = classApplicationIdSchema.safeParse(id);

  if (!parsed.success) {
    notFound();
  }

  const application = await getApplicationById(parsed.data);

  if (!application || application.applicant_id !== session.user.id) {
    notFound();
  }

  const [history, createdClass, query] = await Promise.all([
    listApplicationReviews(application.id),
    application.created_class_id
      ? getClassById(application.created_class_id)
      : Promise.resolve(null),
    searchParams,
  ]);

  const canEdit =
    application.status === "pending" || application.status === "rejected";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/applications"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        All applications
      </Link>

      {query.saved ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Application saved. A platform admin will review it.
        </Alert>
      ) : null}

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={application.status} />
            <span className="text-muted-foreground text-xs">
              Submitted {formatDate(application.created_at)}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {application.proposed_name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            /classes/{application.proposed_slug}
          </p>
        </div>
        {application.status === "pending" ? (
          <WithdrawApplicationButton applicationId={application.id} />
        ) : null}
      </header>

      {application.status === "rejected" && application.decision_note ? (
        <Alert
          variant="error"
          className="mt-5"
        >
          <p className="font-medium">This application was rejected.</p>
          <p className="mt-1">{application.decision_note}</p>
          <p className="mt-2 text-xs">
            Correct the details below and resubmit; the application returns to
            the review queue.
          </p>
        </Alert>
      ) : null}

      {application.status === "approved" && createdClass ? (
        <Alert
          variant="success"
          className="mt-5"
        >
          <p className="font-medium">Class approved</p>
          <p className="mt-1">
            {createdClass.name} is live.{" "}
            <Link
              href={`/classes/${createdClass.slug}`}
              className="underline"
            >
              View the public class page
            </Link>
            .
          </p>
        </Alert>
      ) : null}

      <section
        aria-labelledby="application-details"
        className="mt-6"
      >
        <h2
          id="application-details"
          className="text-lg font-semibold tracking-tight"
        >
          Application details
        </h2>

        <dl className="border-border mt-3 grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
          <Detail
            label="Course"
            value={application.course_name}
          />
          <Detail
            label="Semester"
            value={`${application.semester} · ${application.academic_year}`}
          />
          <Detail
            label="Institution"
            value={application.institution ?? "Not specified"}
          />
          <Detail
            label="Lecturer"
            value={application.lecturer_name ?? "Not specified"}
          />
        </dl>

        <div className="mt-4 space-y-4 text-sm">
          <div>
            <h3 className="font-medium">Description</h3>
            <p className="text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
              {application.description}
            </p>
          </div>
          <div>
            <h3 className="font-medium">Reason for creating the class</h3>
            <p className="text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
              {application.reason}
            </p>
          </div>
          {application.supporting_info ? (
            <div>
              <h3 className="font-medium">Supporting information</h3>
              <p className="text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                {application.supporting_info}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="decision-history"
        className="mt-8"
      >
        <h2
          id="decision-history"
          className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <History
            aria-hidden="true"
            className="h-4 w-4"
          />
          Decision history
        </h2>

        {history.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            No decision yet. A platform admin will review this application.
          </p>
        ) : (
          <ul className="border-border divide-border mt-3 divide-y rounded-lg border">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="inline-flex items-center gap-1.5 font-medium">
                    {entry.decision === "approved" ? (
                      <CheckCircle2
                        aria-hidden="true"
                        className="text-success h-4 w-4"
                      />
                    ) : null}
                    {entry.decision === "approved" ? "Approved" : "Rejected"}
                  </p>
                  {entry.note ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {entry.note}
                    </p>
                  ) : null}
                </div>
                <span className="text-muted-foreground text-xs">
                  {formatDate(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit ? (
        <section
          aria-labelledby="revise-application"
          className="border-border bg-surface mt-10 rounded-xl border p-5 sm:p-6"
        >
          <h2
            id="revise-application"
            className="text-lg font-semibold tracking-tight"
          >
            {application.status === "rejected"
              ? "Correct and resubmit"
              : "Revise this application"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Saving puts the application back in the platform review queue. You
            cannot approve it yourself.
          </p>

          <div className="mt-6">
            <ClassApplicationForm
              mode="revise"
              applicationId={application.id}
              initialValues={{
                proposedName: application.proposed_name,
                proposedSlug: application.proposed_slug,
                courseName: application.course_name,
                institution: application.institution ?? "",
                lecturerName: application.lecturer_name ?? "",
                semester: application.semester,
                academicYear: application.academic_year,
                description: application.description,
                reason: application.reason,
                supportingInfo: application.supporting_info ?? "",
              }}
            />
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <Button
          asChild
          variant="secondary"
        >
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
