import { ArrowLeft, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinClassForm } from "@/components/classes/join-class-form";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { extractInvitationToken } from "@/lib/utils/invitation-link";

export const metadata: Metadata = {
  title: "Join a class",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type JoinClassPageProps = {
  searchParams: Promise<{ invitation?: string | string[] }>;
};

/**
 * Hand-off into the existing invitation flow.
 *
 * Membership is still granted by `accept_class_invitation` on `/invite/[token]`;
 * this page only turns a pasted link into that route, so there is no second
 * joining path to keep in sync with the RPC.
 */
export default async function JoinClassPage({
  searchParams,
}: JoinClassPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell width="reading">
        <SetupNotice />
      </PageShell>
    );
  }

  const rawParams = await searchParams;
  const submitted =
    typeof rawParams.invitation === "string" ? rawParams.invitation : "";
  const session = await getSessionUser();

  if (!session) {
    const nextPath = submitted
      ? `/classes/join?invitation=${encodeURIComponent(submitted)}`
      : "/classes/join";
    redirect(buildLoginPath(nextPath));
  }

  const token = submitted ? extractInvitationToken(submitted) : null;

  if (token) {
    redirect(`/invite/${encodeURIComponent(token)}`);
  }

  const showInvalid = submitted !== "" && token === null;

  return (
    <PageShell width="reading">
      <Link
        href="/classes"
        className="text-muted-foreground hover:text-foreground focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        My Classes
      </Link>

      <div className="border-border bg-surface mt-4 rounded-xl border p-6 sm:p-8">
        <span className="bg-accent-soft text-accent flex h-11 w-11 items-center justify-center rounded-md">
          <UserPlus
            aria-hidden="true"
            className="h-5 w-5"
          />
        </span>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Join or set up a class
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Enter your class code, semester, and academic year to join your cohort
          class automatically (or create it if nobody has set it up yet). You
          can also paste an invitation link from a class admin.
        </p>

        {showInvalid ? (
          <Alert
            variant="error"
            className="mt-6"
          >
            That does not look like a class invitation link. Paste the full link
            from the class admin, then try again.
          </Alert>
        ) : null}

        <JoinClassForm
          submittedLink={submitted}
          showInvalidLink={showInvalid}
        />
      </div>
    </PageShell>
  );
}
