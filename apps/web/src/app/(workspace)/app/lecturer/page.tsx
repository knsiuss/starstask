import {
  BookOpenText,
  ClipboardList,
  Users,
  GraduationCap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import { isLecturer } from "@/lib/auth/lecturer";
import { getLecturerOverview } from "@/lib/db/lecturer";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Lecturer",
  description: "Classes you administer and the tasks you assign on StarsTask.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LecturerPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Lecturer"
          description="Classes you administer and the tasks you assign on StarsTask."
        />
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/app/lecturer"));
  }

  if (!(await isLecturer())) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Lecturer"
          description="Classes you administer and the tasks you assign on StarsTask."
        />
        <Alert
          variant="warning"
          className="mt-6"
        >
          Lecturer access is not active on this account. Activate it from your
          profile settings with an institutional email and a 10-digit NIDN.
        </Alert>
        <div className="mt-4">
          <Button
            asChild
            size="sm"
            variant="secondary"
          >
            <Link href="/settings/profile#lecturer">
              Activate lecturer access
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const overview = await getLecturerOverview(session.user.id).catch(() => null);

  if (!overview) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Lecturer"
          description="Classes you administer and the tasks you assign on StarsTask."
        />
        <Alert
          variant="error"
          className="mt-6"
        >
          Could not load your lecturer dashboard. Try again in a moment.
        </Alert>
      </div>
    );
  }

  const stats = [
    {
      label: "Classes administered",
      value: overview.classCount,
      icon: GraduationCap,
    },
    {
      label: "Total members",
      value: overview.memberCount,
      icon: Users,
    },
    {
      label: "Tasks you assigned",
      value: overview.publishedCount,
      icon: ClipboardList,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-10 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Lecturer"
        description="A narrow workspace for what you teach: your classes, their members, and the tasks you publish. Nothing here is an official university record."
      />

      <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">
        {stats.map((stat) => (
          <li key={stat.label}>
            <Card className="flex h-full items-center gap-3 p-4">
              <span
                aria-hidden="true"
                className="bg-accent-soft text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              >
                <stat.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="text-muted-foreground block truncate text-xs font-medium">
                  {stat.label}
                </span>
                <span className="text-foreground mt-0.5 block text-2xl leading-none font-semibold tabular-nums tracking-tight">
                  {stat.value}
                </span>
              </span>
            </Card>
          </li>
        ))}
      </ul>

      <section
        aria-labelledby="lecturer-classes"
        className="mt-8"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="lecturer-classes"
            className="text-lg font-semibold tracking-tight"
          >
            Your classes
          </h2>
          <Link
            href="/classes"
            className="text-accent text-sm font-medium hover:underline"
          >
            All classes
          </Link>
        </div>

        {overview.classes.length === 0 ? (
          <Card className="mt-3 border-dashed">
            <p className="text-sm font-medium">
              You do not administer any class yet
            </p>
            <p className="text-muted-foreground mt-1 max-w-md text-sm leading-relaxed">
              Classes appear here once you become their administrator. Any
              member of an active class can claim class admin access from their
              profile settings — the class decides who steps up.
            </p>
            <div className="mt-3">
              <Button
                asChild
                size="sm"
                variant="secondary"
              >
                <Link href="/settings/profile#class-admin">
                  Go to class admin access
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {overview.classes.map((row) => (
              <li key={row.id}>
                <Card className="flex h-full flex-col">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                      {row.class_code ?? row.slug}
                    </span>
                    <span className="text-muted-foreground">
                      {row.semester} · {row.academic_year}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base leading-snug font-semibold">
                    <Link
                      href={`/app/classes/${row.slug}`}
                      className="hover:text-accent focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {row.name}
                    </Link>
                  </h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {row.course_name}
                  </p>
                  <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Users
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      {row.member_count} {pluralize(row.member_count, "member")}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ClipboardList
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      {row.published_count}{" "}
                      {pluralize(row.published_count, "published task")}
                    </span>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-3 pt-4">
                    <Link
                      href={`/app/classes/${row.slug}/attendance`}
                      className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                    >
                      <BookOpenText
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      Attendance
                    </Link>
                    <Link
                      href={`/app/classes/${row.slug}/manage`}
                      className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                    >
                      Manage class
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground mt-8 max-w-2xl text-[11px] leading-relaxed">
        StarsTask is not your university&rsquo;s official system and this page
        is not an academic record. If your university needs an official
        attendance or grade submission, that happens on your university&rsquo;s
        own systems after you verify it there.
      </p>
    </div>
  );
}
