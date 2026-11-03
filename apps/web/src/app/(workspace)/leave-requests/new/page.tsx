import { ArrowLeft, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  LeaveForm,
  type LeaveClassChoice,
} from "@/components/leave/leave-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import {
  listActiveCoursesByClass,
  listMyClasses,
  type ClassCourseSummary,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "New absence request",
  description: "Record your absence dates and attach the supporting document.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer =
  "mx-auto w-full max-w-2xl px-4 pt-5 pb-10 sm:px-6 sm:pt-7 lg:px-10";

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
  const [firstClass] = myClasses;
  const requested = requestedSlug
    ? myClasses.find((item) => item.slug === requestedSlug)
    : undefined;
  // The request belongs to exactly one class; a student with several starts on
  // the first one and can switch inside the form without losing what they wrote.
  const selected = requested ?? firstClass;

  if (!selected) {
    return (
      <div className={pageContainer}>
        <BackLink />

        <header className="mt-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            New absence request
          </h1>
        </header>

        <div className="border-border bg-surface mt-4 rounded-2xl border p-6 text-center">
          <span className="bg-accent-soft text-accent mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
            <GraduationCap
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
          <p className="mt-3 text-sm font-semibold">
            You are not in a class yet
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-xs leading-relaxed">
            An absence request always belongs to a class, so join one first.
          </p>
          <Link
            href="/classes/discover"
            className="text-accent mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline"
          >
            Browse classes
          </Link>
        </div>
      </div>
    );
  }

  const coursesByClass = await listActiveCoursesByClass(
    myClasses.map((item) => item.id),
  ).catch(() => new Map<string, ClassCourseSummary[]>());

  const classChoices: LeaveClassChoice[] = myClasses.map((item) => {
    const courses = coursesByClass.get(item.id) ?? [];

    return {
      id: item.id,
      name: item.name,
      courses:
        courses.length > 0
          ? courses.map((course) =>
              course.code ? `${course.code} · ${course.name}` : course.name,
            )
          : item.course_name
            ? [item.course_name]
            : [],
    };
  });

  return (
    <div className={pageContainer}>
      <BackLink />

      <header className="mt-2">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-3xl">
          New absence request
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Request permission for your absence.
        </p>
      </header>

      {requestedSlug && !requested ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          <p className="text-[13px] font-medium">
            That class is not one of yours — this request uses {selected.name}{" "}
            instead.
          </p>
          <p className="mt-1 text-xs">
            <Link
              href="/classes/discover"
              className="underline underline-offset-4"
            >
              Browse classes
            </Link>{" "}
            to join it first.
          </p>
        </Alert>
      ) : null}

      <div className="mt-4">
        <LeaveForm
          mode="create"
          classId={selected.id}
          classes={classChoices}
          initial={EMPTY_INITIAL}
        />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/leave-requests"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[13px] font-medium"
    >
      <ArrowLeft
        aria-hidden="true"
        className="h-4 w-4"
      />
      Absence Requests
    </Link>
  );
}
