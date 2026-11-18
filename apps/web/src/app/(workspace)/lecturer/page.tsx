import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { TeachingHome } from "@/components/lecturer/teaching-home";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isLecturer } from "@/lib/auth/lecturer";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Lecturer",
  description: "Classes you administer and the tasks you assign on StarsTask.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LecturerPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell width="wide">
        <PageHeader
          title="Lecturer"
          description="Classes you administer and the tasks you assign on StarsTask."
        />
        <div className="mt-6">
          <SetupNotice />
        </div>
      </PageShell>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/lecturer"));
  }

  if (await isLecturer()) {
    return (
      <TeachingHome
        userId={session.user.id}
        displayName={session.profile?.display_name ?? "Lecturer"}
      />
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title="Lecturer"
        description="Classes you administer and the tasks you assign on StarsTask."
      />
      <Alert
        variant="warning"
        className="mt-6"
      >
        Lecturer access is not active on this account. Activate it from your
        profile settings.
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
    </PageShell>
  );
}
