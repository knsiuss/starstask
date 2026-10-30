import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { SessionForm } from "@/components/sessions/session-form";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getClassRole } from "@/lib/db/classes";
import { getSessionAssignmentOptions, getSessionById } from "@/lib/db/sessions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { sessionIdSchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Edit session",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type EditSessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSessionPage({
  params,
}: EditSessionPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const viewer = await getSessionUser();

  if (!viewer) {
    redirect(buildLoginPath("/sessions"));
  }

  const { id } = await params;
  const parsedId = sessionIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const session = await getSessionById(parsedId.data);

  if (!session) {
    notFound();
  }

  const role = await getClassRole(session.classId);

  // A non-manager is told the page does not exist rather than that it is
  // forbidden, so the page cannot be used to probe for private sessions.
  if (!role.canManage) {
    notFound();
  }

  const assignments = await getSessionAssignmentOptions(session.classId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/sessions/${session.id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to the session
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Edit session</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {session.className}
        </p>
      </header>

      <div className="mt-6">
        {session.status === "scheduled" ? (
          <SessionForm
            classId={session.classId}
            classSlug={session.classSlug}
            assignments={assignments}
            session={session}
            defaultTimeZone={session.timeZone}
          />
        ) : (
          <Alert variant="warning">
            <p className="font-medium">
              {session.status === "cancelled"
                ? "This session was cancelled."
                : "This session is already completed."}
            </p>
            <p className="mt-1">
              Only scheduled sessions can be edited.{" "}
              <Link
                href={`/sessions/${session.id}`}
                className="underline"
              >
                Reopen it
              </Link>{" "}
              first if the details need to change.
            </p>
          </Alert>
        )}
      </div>
    </div>
  );
}
