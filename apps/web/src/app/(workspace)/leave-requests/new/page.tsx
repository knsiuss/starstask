import { ArrowLeft, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LeaveForm } from "@/components/leave/leave-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { listMyClasses } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "New absence request",
  description: "Record your absence dates and attach the supporting document.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10";

/** A draft starts empty; every field is the student's to fill or confirm. */
const EMPTY_INITIAL = {
  leaveStartDate: "",
  leaveEndDate: "",
  reasonCategory: "",
  explanation: "",
  documentIssueDate: "",
};

type NewLeaveRequestPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewLeaveRequestPage({
  searchParams,
}: NewLeaveRequestPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/leave-requests/new"));
  }

  const flat = flattenSearchParams(await searchParams);
  const requestedSlug = flat.class;
  const myClasses = await listMyClasses(session.user.id);

  const requested = requestedSlug
    ? myClasses.find((item) => item.slug === requestedSlug)
    : undefined;

  // No class chosen and only one to choose from: skip the picker entirely.
  const onlyClass = myClasses.length === 1 ? myClasses[0] : undefined;
  const selected = requested ?? (!requestedSlug ? onlyClass : undefined);

  return (
    <div className={pageContainer}>
      <Link
        href="/leave-requests"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Your absence requests
      </Link>

      {requestedSlug && !requested ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          <p className="font-medium">That class is not one of yours.</p>
          <p className="mt-1">
            Pick one of your own classes below, or{" "}
            <Link
              href="/classes/discover"
              className="underline"
            >
              browse classes
            </Link>{" "}
            to join it first.
          </p>
        </Alert>
      ) : null}

      {myClasses.length === 0 ? (
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm font-medium">You are not in a class yet</p>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm">
            An absence request is always attached to a class, so join one before
            creating a request.
          </p>
          <Link
            href="/classes/discover"
            className="text-accent mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline"
          >
            Browse classes
          </Link>
        </Card>
      ) : selected ? (
        <>
          <header className="mt-4">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
              New absence request
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              For{" "}
              <Link
                href={`/dashboard/classes/${selected.slug}`}
                className="text-foreground font-medium underline-offset-4 hover:underline"
              >
                {selected.name}
              </Link>
              . Save it as a draft now and finish it later — nothing is sent
              until you submit.
            </p>
          </header>

          <div className="mt-6">
            <LeaveForm
              mode="create"
              classId={selected.id}
              initial={EMPTY_INITIAL}
            />
          </div>

          <Card className="mt-8">
            <h2 className="text-sm font-semibold">Before you submit</h2>
            <ul className="text-muted-foreground mt-2 grid list-disc gap-1 pl-5 text-sm">
              <li>
                The absence start and end dates, as written on the document.
              </li>
              <li>A reason category and a short explanation.</li>
              <li>
                At least one supporting document — PDF, JPG, or PNG, up to 10
                MB.
              </li>
              <li>
                If your document has an issue date, record it separately. It is
                not the same as the absence dates.
              </li>
            </ul>
          </Card>
        </>
      ) : (
        <>
          <header className="mt-4">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
              New absence request
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Which class is this request for?
            </p>
          </header>

          <ul className="mt-6 grid gap-3">
            {myClasses.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/leave-requests/new?class=${item.slug}`}
                  className="border-border bg-card hover:border-accent/60 focus-visible:ring-ring flex items-start gap-3 rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <GraduationCap
                    aria-hidden="true"
                    className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold">
                      {item.name}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {item.course_name} · {item.semester} {item.academic_year}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
