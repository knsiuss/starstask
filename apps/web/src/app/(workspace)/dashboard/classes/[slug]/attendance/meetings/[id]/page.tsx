import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttendanceMeetingDashboard } from "@/components/attendance/attendance-meeting-dashboard";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import { getAttendanceMeetingDetail } from "@/lib/db/attendance-meetings";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { sessionIdSchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Attendance meeting",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AttendanceMeetingPageProps = {
  params: Promise<{ slug: string; id: string }>;
};

export default async function AttendanceMeetingPage({
  params,
}: AttendanceMeetingPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const { slug, id } = await params;
  const viewer = await getSessionUser();

  if (!viewer) {
    redirect(
      buildLoginPath(`/dashboard/classes/${slug}/attendance/meetings/${id}`),
    );
  }

  const parsedId = sessionIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const classRecord = await getClassBySlug(slug);

  if (!classRecord) {
    notFound();
  }

  const role = await getClassRole(classRecord.id);

  // The database functions re-check this too; the page only avoids rendering
  // a roster the viewer is not allowed to see.
  if (!role.canManage) {
    notFound();
  }

  const detail = await getAttendanceMeetingDetail(
    parsedId.data,
    classRecord.id,
  );

  if (!detail) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/classes/${classRecord.slug}?tab=attendance`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        {classRecord.name} attendance
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {detail.subjectName} · Pertemuan {detail.meetingNumber}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {classRecord.name}
          {classRecord.class_code ? ` · ${classRecord.class_code}` : ""} ·{" "}
          {classRecord.semester} {classRecord.academic_year}
        </p>
      </header>

      <AttendanceMeetingDashboard
        classSlug={classRecord.slug}
        initialDetail={detail}
      />
    </div>
  );
}
