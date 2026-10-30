import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { SessionForm } from "@/components/sessions/session-form";
import { getSessionUser } from "@/lib/auth/session";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import { getNotificationPreferences } from "@/lib/db/push";
import { getSessionAssignmentOptions } from "@/lib/db/sessions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Schedule a session",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type NewClassSessionPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function NewClassSessionPage({
  params,
}: NewClassSessionPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const { slug } = await params;
  const viewer = await getSessionUser();

  if (!viewer) {
    redirect(buildLoginPath(`/dashboard/classes/${slug}/sessions/new`));
  }

  const classRecord = await getClassBySlug(slug);

  if (!classRecord) {
    notFound();
  }

  const role = await getClassRole(classRecord.id);

  if (!role.canManage) {
    notFound();
  }

  const [assignments, preferences] = await Promise.all([
    getSessionAssignmentOptions(classRecord.id),
    getNotificationPreferences(viewer.user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/dashboard/classes/${slug}/sessions`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        {classRecord.name} sessions
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Schedule a session
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {classRecord.name} · {classRecord.semester}
        </p>
      </header>

      <div className="mt-6">
        <SessionForm
          classId={classRecord.id}
          classSlug={classRecord.slug}
          assignments={assignments}
          defaultTimeZone={preferences.timezone}
        />
      </div>
    </div>
  );
}
