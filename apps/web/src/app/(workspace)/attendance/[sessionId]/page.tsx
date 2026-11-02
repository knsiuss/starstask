import { ArrowLeft, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttendanceStatusBadge } from "@/components/attendance/attendance-status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getStudentAttendanceEntry } from "@/lib/db/attendance";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { SESSION_TYPE_LABELS, sessionIdSchema } from "@starstask/contracts";
import {
  formatSessionDate,
  formatSessionRange,
  formatSessionTime,
  timeZoneLabel,
} from "@starstask/shared";

export const metadata: Metadata = {
  title: "Attendance record",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:px-10";

type AttendanceDetailPageProps = {
  params: Promise<{ sessionId: string }>;
};

function recordedByLabel(entry: {
  recordedByName: string | null;
  method: "geo" | "manual" | "system" | null;
}): string {
  if (entry.recordedByName) {
    return entry.recordedByName;
  }

  if (entry.method === "geo") {
    return "You, by checking in at the session location";
  }

  if (entry.method === "manual") {
    return "Recorded by a class admin";
  }

  if (entry.method === "system") {
    return "Recorded automatically when attendance was finalized";
  }

  return "—";
}

export default async function AttendanceDetailPage({
  params,
}: AttendanceDetailPageProps) {
  const { sessionId } = await params;
  const parsed = sessionIdSchema.safeParse(sessionId);

  if (!parsed.success) {
    notFound();
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(`/attendance/${sessionId}`));
  }

  const entry = await getStudentAttendanceEntry(parsed.data, session.user.id);

  if (!entry) {
    notFound();
  }

  const scheduled = formatSessionRange(
    entry.startsAt,
    entry.endsAt,
    entry.timeZone,
  );

  return (
    <div className={pageContainer}>
      <Link
        href="/attendance"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
        Back to attendance
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              {entry.title}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {entry.className} · {entry.subjectName ?? "No linked subject"} ·{" "}
              {SESSION_TYPE_LABELS[entry.sessionType]}
            </p>
          </div>
          <AttendanceStatusBadge
            status={entry.status}
            className="mt-0.5"
          />
        </div>
      </header>

      {entry.status === "pending" ? (
        <Alert className="mt-5">
          This session has not finished yet, so it is not counted in your
          attendance percentage.
        </Alert>
      ) : null}

      {entry.status === "unrecorded" ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          No attendance has been recorded for this session yet. A missing record
          is never counted as present; your class admin can record it.
        </Alert>
      ) : null}

      {entry.status === "excused" ? (
        <Alert
          variant="success"
          className="mt-5"
        >
          This absence was approved and marked excused. An excused session is
          excluded from your attendance percentage.
        </Alert>
      ) : null}

      <section
        aria-label="Attendance details"
        className="border-border bg-surface mt-5 overflow-hidden rounded-xl border"
      >
        <dl className="divide-border divide-y text-sm">
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Class</dt>
            <dd>
              <Link
                href={`/dashboard/classes/${entry.classSlug}`}
                className="text-accent hover:underline"
              >
                {entry.className}
              </Link>
              <span className="text-muted-foreground">
                {" "}
                · {entry.academicYear} · {entry.semester}
              </span>
            </dd>
          </div>

          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Subject</dt>
            <dd>{entry.subjectName ?? "No linked subject"}</dd>
          </div>

          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Session date</dt>
            <dd>
              {formatSessionDate(entry.startsAt, entry.timeZone, {
                withWeekday: true,
              })}
            </dd>
          </div>

          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Scheduled time</dt>
            <dd>
              {scheduled}{" "}
              <span className="text-muted-foreground">
                ({timeZoneLabel(entry.timeZone)})
              </span>
            </dd>
          </div>

          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Actual check-in</dt>
            <dd>
              {entry.checkedInAt
                ? `${formatSessionDate(entry.checkedInAt, entry.timeZone)}, ${formatSessionTime(entry.checkedInAt, entry.timeZone)}`
                : "Not checked in"}
            </dd>
          </div>

          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Recorded by</dt>
            <dd>{recordedByLabel(entry)}</dd>
          </div>

          {entry.location ? (
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="flex items-start gap-1.5">
                <MapPin
                  aria-hidden="true"
                  className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                {entry.location}
              </dd>
            </div>
          ) : null}

          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-line">
              {entry.note ?? "No notes on this record."}
            </dd>
          </div>
        </dl>
      </section>

      <p className="text-muted-foreground mt-4 text-xs">
        Only you and your class admins can see this record. Students cannot
        change attendance; ask your class admin if something looks wrong.{" "}
        <Link
          href={`/sessions/${entry.sessionId}`}
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          View session details
        </Link>
      </p>
    </div>
  );
}
