import { ArrowLeft, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ApplicationDecisionForm } from "@/components/admin/application-decision-form";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import {
  getApplicationById,
  getClassById,
  isPlatformAdmin,
  listApplicationReviews,
  loadProfiles,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { classApplicationIdSchema } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Review class application",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminApplicationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminApplicationPage({
  params,
}: AdminApplicationPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/admin"));
  }

  if (!(await isPlatformAdmin())) {
    notFound();
  }

  const { id } = await params;
  const parsed = classApplicationIdSchema.safeParse(id);

  if (!parsed.success) {
    notFound();
  }

  const application = await getApplicationById(parsed.data);

  if (!application) {
    notFound();
  }

  const [history, profiles, createdClass] = await Promise.all([
    listApplicationReviews(application.id),
    loadProfiles([application.applicant_id]),
    application.created_class_id
      ? getClassById(application.created_class_id)
      : Promise.resolve(null),
  ]);

  const applicant =
    profiles.get(application.applicant_id)?.display_name ?? "StarsTask member";
  const isPending = application.status === "pending";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Platform administration
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={application.status} />
          <span className="text-muted-foreground text-xs">
            Submitted {formatDate(application.created_at)} by {applicant}
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {application.proposed_name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Proposed link: /classes/{application.proposed_slug}
        </p>
      </header>

      {application.status === "withdrawn" ? (
        <Alert
          variant="info"
          className="mt-5"
        >
          The applicant withdrew this application. No decision is needed.
        </Alert>
      ) : null}

      {createdClass ? (
        <Alert
          variant="success"
          className="mt-5"
        >
          Approved.{" "}
          <Link
            href={`/admin/classes/${createdClass.slug}`}
            className="underline"
          >
            Manage {createdClass.name}
          </Link>
          .
        </Alert>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Proposed class</h2>
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

      {isPending ? (
        <section
          aria-labelledby="decision"
          className="border-border bg-surface mt-8 rounded-xl border p-5 sm:p-6"
        >
          <h2
            id="decision"
            className="text-lg font-semibold tracking-tight"
          >
            Platform decision
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Approval creates the class. Granting the class admin role is a
            separate, explicit choice.
          </p>
          <div className="mt-5">
            <ApplicationDecisionForm applicationId={application.id} />
          </div>
        </section>
      ) : application.decision_note ? (
        <Alert
          variant={application.status === "rejected" ? "error" : "info"}
          className="mt-8"
        >
          <p className="font-medium">Reviewer note</p>
          <p className="mt-1">{application.decision_note}</p>
        </Alert>
      ) : null}

      <section className="mt-8">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <History
            aria-hidden="true"
            className="h-4 w-4"
          />
          Decision history
        </h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            No decision recorded yet.
          </p>
        ) : (
          <ul className="divide-border border-border mt-3 divide-y rounded-lg border text-sm">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="px-4 py-3"
              >
                <p className="font-medium capitalize">{entry.decision}</p>
                {entry.note ? (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {entry.note}
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {formatDate(entry.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
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
