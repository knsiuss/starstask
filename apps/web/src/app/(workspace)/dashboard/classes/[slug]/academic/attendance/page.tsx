import { ArrowLeft, CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AttendanceMeetingForm } from "@/components/academic/attendance-meeting-form";
import { AttendancePaperImport } from "@/components/academic/attendance-paper-import";
import { AttendanceRoster } from "@/components/academic/attendance-roster";
import { CorrectionForm } from "@/components/academic/correction-form";
import { ClassUnlinkedNotice } from "@/components/academic/unlinked-notice";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import { resolveClassPermissionForPage } from "@/lib/authz/class-permission";
import {
  getOfferingRoster,
  listCorrectionsForMeeting,
  listMeetingsForClass,
  listRecordsForMeeting,
} from "@/lib/db/academic-attendance";
import { listOfferingsForClass } from "@/lib/db/course-offerings";
import { isSupabaseConfigured } from "@/lib/env/public";
import { formatInTimeZone } from "@/lib/utils/timezone";
import { flattenSearchParams } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "Normalized attendance",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AttendancePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AcademicAttendancePage({
  params,
  searchParams,
}: AttendancePageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const { slug } = await params;
  const access = await resolveClassPermissionForPage(slug, "manage_attendance");

  if (!access.ok) {
    if (access.reason === "unlinked") {
      return (
        <Shell slug={slug}>
          <ClassUnlinkedNotice />
        </Shell>
      );
    }

    notFound();
  }

  const { classRow } = access;
  const flat = flattenSearchParams(await searchParams);
  const offerings = await listOfferingsForClass(classRow.id);
  const offeringIds = offerings.map((offering) => offering.id);
  const selectedOfferingId =
    offerings.find((offering) => offering.id === flat.offering)?.id ??
    offerings[0]?.id ??
    null;

  const service = requireServiceRoleClient();
  const { data: universityRow } = await service
    .from("universities")
    .select("timezone")
    .eq("id", classRow.universityId)
    .maybeSingle();
  const universityTimeZone = universityRow?.timezone ?? null;
  const meetings = await listMeetingsForClass(
    service,
    selectedOfferingId ? [selectedOfferingId] : [],
  );
  const selectedMeetingId =
    meetings.find((meeting) => meeting.id === flat.meeting)?.id ??
    meetings[0]?.id ??
    null;

  const roster = selectedMeetingId
    ? await getOfferingRoster(
        service,
        selectedOfferingId ?? "",
        classRow.universityId,
      )
    : [];

  const records = selectedMeetingId
    ? await listRecordsForMeeting(service, selectedMeetingId)
    : [];
  const recordByIdentity = new Map(
    records.map((record) => [record.studentIdentityId, record]),
  );
  const corrections = selectedMeetingId
    ? await listCorrectionsForMeeting(
        service,
        records.map((record) => record.id),
      )
    : [];

  return (
    <Shell slug={classRow.slug}>
      {offerings.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">
          No offerings for this class yet. Offerings are created by the platform
          operator.
        </p>
      ) : (
        <>
          <nav
            aria-label="Offerings"
            className="mt-6 flex flex-wrap gap-2"
          >
            {offerings.map((offering) => (
              <Link
                key={offering.id}
                href={`/dashboard/classes/${classRow.slug}/academic/attendance?offering=${offering.id}`}
                aria-current={
                  offering.id === selectedOfferingId ? "true" : undefined
                }
                className={
                  offering.id === selectedOfferingId
                    ? "bg-accent-soft text-accent rounded-full px-3 py-1.5 text-sm font-medium"
                    : "hover:bg-muted text-muted-foreground rounded-full px-3 py-1.5 text-sm"
                }
              >
                {offering.courseCode ?? offering.courseName}
              </Link>
            ))}
          </nav>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Meetings</CardTitle>
              <CardDescription>
                Create and browse normalized attendance meetings for the
                selected offering.
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6">
              <AttendanceMeetingForm
                classSlug={classRow.slug}
                offeringId={selectedOfferingId ?? ""}
              />
              <ul className="divide-border mt-4 divide-y text-sm">
                {meetings.map((meeting) => (
                  <li
                    key={meeting.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <Link
                      href={`/dashboard/classes/${classRow.slug}/academic/attendance?offering=${selectedOfferingId}&meeting=${meeting.id}`}
                      className="hover:text-foreground font-medium hover:underline"
                    >
                      {formatInTimeZone(
                        meeting.scheduledAt,
                        universityTimeZone,
                      )}
                    </Link>
                    <span className="flex items-center gap-2">
                      {meeting.location ? (
                        <span className="text-muted-foreground text-xs">
                          {meeting.location}
                        </span>
                      ) : null}
                      <Badge variant="neutral">{meeting.status}</Badge>
                    </span>
                  </li>
                ))}
                {meetings.length === 0 ? (
                  <li className="text-muted-foreground py-2 text-sm">
                    No meetings yet.
                  </li>
                ) : null}
              </ul>
            </div>
          </Card>

          {selectedMeetingId ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Roster &amp; records</CardTitle>
                <CardDescription>
                  Statuses: present, late, excused, sick, absent. Changes after
                  saving go through the corrections ledger.
                </CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <AttendanceRoster
                  classSlug={classRow.slug}
                  meetingId={selectedMeetingId}
                  entries={roster.map((row) => ({
                    studentIdentityId: row.studentIdentityId,
                    displayName: row.displayName,
                    studentCode: row.studentCode,
                    currentStatus:
                      recordByIdentity.get(row.studentIdentityId)?.status ??
                      null,
                  }))}
                />

                <AttendancePaperImport
                  classSlug={classRow.slug}
                  meetingId={selectedMeetingId}
                  entries={roster.map((row) => ({
                    studentIdentityId: row.studentIdentityId,
                    displayName: row.displayName,
                    studentCode: row.studentCode,
                    currentStatus:
                      recordByIdentity.get(row.studentIdentityId)?.status ??
                      null,
                  }))}
                />

                {records.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold">Corrections</h3>
                    <ul className="divide-border mt-2 divide-y">
                      {records.map((record) => (
                        <li
                          key={record.id}
                          className="py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm">
                              {roster.find(
                                (row) =>
                                  row.studentIdentityId ===
                                  record.studentIdentityId,
                              )?.displayName ??
                                record.studentIdentityId.slice(0, 8)}{" "}
                              — <Badge variant="neutral">{record.status}</Badge>
                            </span>
                            <CorrectionForm
                              classSlug={classRow.slug}
                              recordId={record.id}
                              currentStatus={record.status}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                    {corrections.length > 0 ? (
                      <ul className="text-muted-foreground mt-4 space-y-1 text-xs">
                        {corrections.map((correction) => (
                          <li key={correction.id}>
                            {new Date(correction.correctedAt).toLocaleString()}{" "}
                            — {correction.previousStatus} →{" "}
                            {correction.newStatus}: {correction.reason}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}
        </>
      )}
    </Shell>
  );
}

function Shell({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/classes/${slug}/academic`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Academic administration
      </Link>
      <header className="mt-4 flex items-center gap-3">
        <CalendarClock
          aria-hidden="true"
          className="text-accent h-6 w-6"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Normalized attendance
        </h1>
      </header>
      {children}
    </div>
  );
}
