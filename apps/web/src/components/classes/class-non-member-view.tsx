import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/classes/status-badge";
import { Button } from "@/components/ui/button";
import type { ClassSummary } from "@/lib/db/classes";

type ClassNonMemberViewProps = {
  classSummary: ClassSummary;
};

/**
 * Rendered at `/classes/[slug]` when a signed-in user is not a member yet,
 * so shared class links explain how to join instead of returning a 404.
 */
export function ClassNonMemberView({ classSummary }: ClassNonMemberViewProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/classes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        My Classes
      </Link>

      <header className="border-border bg-surface mt-4 rounded-xl border p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge status={classSummary.status} />
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 font-medium">
            {classSummary.course_name}
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {classSummary.name}
        </h1>

        <dl className="text-muted-foreground mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="inline-flex items-center gap-2">
            <GraduationCap
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            <dt className="sr-only">Academic period</dt>
            <dd>
              {classSummary.semester} · {classSummary.academic_year}
            </dd>
          </div>
          {classSummary.lecturer_name ? (
            <div className="inline-flex items-center gap-2">
              <UserRound
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <dt className="sr-only">Lecturer</dt>
              <dd>{classSummary.lecturer_name}</dd>
            </div>
          ) : null}
          {classSummary.institution ? (
            <div className="inline-flex items-center gap-2">
              <BookOpen
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <dt className="sr-only">Institution</dt>
              <dd>{classSummary.institution}</dd>
            </div>
          ) : null}
        </dl>

        {classSummary.description ? (
          <p className="text-muted-foreground mt-5 text-sm leading-relaxed whitespace-pre-line">
            {classSummary.description}
          </p>
        ) : null}

        <div className="border-border bg-subtle mt-6 rounded-lg border p-4">
          <p className="text-foreground inline-flex items-center gap-2 text-sm font-medium">
            <ShieldCheck
              aria-hidden="true"
              className="text-accent h-4 w-4 shrink-0"
            />
            Membership is by invitation
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            You are not a member of this class yet. Ask the class admin (ketua
            kelas) or lecturer for an invitation link to access courses,
            assignments, and attendance.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
            >
              <Link href="/classes/join">Enter invite code</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link href="/classes/discover">Browse public classes</Link>
            </Button>
          </div>
        </div>
      </header>
    </div>
  );
}
