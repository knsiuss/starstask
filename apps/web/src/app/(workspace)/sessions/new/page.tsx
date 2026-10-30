import { ArrowLeft, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { SessionForm } from "@/components/sessions/session-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getNotificationPreferences } from "@/lib/db/push";
import {
  getManageableClassOptions,
  getSessionAssignmentOptions,
} from "@/lib/db/sessions";
import type { SessionClassOption } from "@/lib/db/sessions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { classIdSchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Schedule a session",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type NewSessionPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewSessionPage({
  searchParams,
}: NewSessionPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const viewer = await getSessionUser();

  if (!viewer) {
    redirect(buildLoginPath("/sessions/new"));
  }

  const manageable = await getManageableClassOptions(viewer.user.id);

  if (manageable.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Schedule a session
        </h1>
        <Card className="mt-6">
          <p className="font-medium">
            You cannot schedule sessions for any class yet.
          </p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Sessions are created by a class admin (ketua kelas) or a platform
            admin. Ask a class admin to grant you the class admin role, then
            come back.
          </p>
          <Button
            asChild
            variant="secondary"
            className="mt-4"
          >
            <Link href="/classes/discover">
              <GraduationCap
                aria-hidden="true"
                className="h-4 w-4"
              />
              Browse classes
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const flat = flattenSearchParams(await searchParams);
  const requestedClassId = classIdSchema.safeParse(flat.class).success
    ? flat.class
    : undefined;

  // One manageable class means there is nothing to choose, so skip the picker.
  const onlyClass = manageable[0];

  if (!requestedClassId && manageable.length === 1 && onlyClass) {
    redirect(`/sessions/new?class=${onlyClass.id}`);
  }

  const selected = requestedClassId
    ? manageable.find((classItem) => classItem.id === requestedClassId)
    : undefined;

  const backLink = (
    <Link
      href="/sessions"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft
        aria-hidden="true"
        className="h-4 w-4"
      />
      All sessions
    </Link>
  );

  if (requestedClassId && !selected) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {backLink}
        <Alert
          variant="error"
          className="mt-4"
        >
          <p className="font-medium">
            You cannot schedule sessions for that class.
          </p>
          <p className="mt-1">Pick one of your own classes instead.</p>
        </Alert>
        <div className="mt-4">
          <ClassPicker classes={manageable} />
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {backLink}
        <header className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            Schedule a session
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Choose the class the session belongs to.
          </p>
        </header>
        <div className="mt-6">
          <ClassPicker classes={manageable} />
        </div>
      </div>
    );
  }

  const [assignments, preferences] = await Promise.all([
    getSessionAssignmentOptions(selected.id),
    getNotificationPreferences(viewer.user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/dashboard/classes/${selected.slug}/sessions`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        {selected.name} sessions
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Schedule a session
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {selected.name} · {selected.semester}
        </p>
      </header>

      <div className="mt-6">
        <SessionForm
          classId={selected.id}
          classSlug={selected.slug}
          assignments={assignments}
          defaultTimeZone={preferences.timezone}
        />
      </div>
    </div>
  );
}

/** Class chooser for the classes this user may schedule sessions in. */
function ClassPicker({ classes }: { classes: SessionClassOption[] }) {
  return (
    <ul className="space-y-2">
      {classes.map((classItem) => (
        <li key={classItem.id}>
          <Link
            href={`/sessions/new?class=${classItem.id}`}
            className="border-border bg-surface hover:border-accent/40 focus-visible:outline-accent flex items-center justify-between gap-3 rounded-xl border p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {classItem.name}
              </span>
              <span className="text-muted-foreground block text-xs">
                {classItem.semester}
              </span>
            </span>
            <span className="text-accent text-sm font-medium">Choose</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
