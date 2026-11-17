import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import { isLecturer } from "@/lib/auth/lecturer";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Lecturer",
  description: "Classes you administer and the tasks you assign on StarsTask.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Legacy lecturer URL.
 *
 * The teaching console now lives at `/app`, which every role already opens
 * first. This route stays only so old links and bookmarks keep working, and
 * still explains the activation path to an account without lecturer access.
 */
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

  if (await isLecturer()) {
    redirect("/app");
  }

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
    </div>
  );
}
