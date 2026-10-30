import { ArrowRight, Clock, MailPlus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InviteAcceptButton } from "@/components/classes/invite-accept-button";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getInvitationPreview } from "@/features/classes/class-invitation-service";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { classInvitationAcceptSchema } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class invitation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const parsed = classInvitationAcceptSchema.safeParse({ token });
  const session = await getSessionUser();
  const preview = parsed.success
    ? await getInvitationPreview(parsed.data.token)
    : null;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="border-border bg-surface rounded-xl border p-6 sm:p-8">
          <span className="bg-accent-soft text-accent flex h-11 w-11 items-center justify-center rounded-md">
            <MailPlus
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Class invitation
          </h1>

          <div className="mt-6 space-y-4">
            {!parsed.success || (preview && preview.reason === "not_found") ? (
              <>
                <Alert variant="error">
                  This invitation link is invalid or incomplete. Ask the class
                  admin to send a valid link.
                </Alert>
                <Button
                  asChild
                  variant="secondary"
                  className="w-full"
                >
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </>
            ) : preview && !preview.valid ? (
              <>
                <Alert variant="error">
                  {preview.reason === "expired"
                    ? "This invitation link has expired."
                    : preview.reason === "revoked"
                      ? "This invitation link has been revoked."
                      : preview.reason === "exhausted"
                        ? "This invitation link has reached its maximum usage limit."
                        : preview.reason === "email_mismatch"
                          ? "This invitation is restricted to a different email address."
                          : "This invitation is no longer valid."}
                </Alert>
                <Button
                  asChild
                  variant="secondary"
                  className="w-full"
                >
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </>
            ) : preview?.is_member ? (
              <div className="space-y-4">
                <Alert variant="info">
                  You are already an active member of{" "}
                  <strong>{preview.class_name}</strong> ({preview.class_slug}). You
                  already have full access to all its subjects and assignments.
                </Alert>
                <Button
                  asChild
                  className="w-full"
                >
                  <Link href={`/dashboard/classes/${preview.class_slug}`}>
                    Open class group
                    <ArrowRight
                      aria-hidden="true"
                      className="ml-1.5 h-4 w-4"
                    />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {preview ? (
                  <div className="bg-subtle border-border rounded-lg border p-4">
                    <p className="text-foreground text-base font-semibold">
                      {preview.class_name}
                    </p>
                    <p className="font-mono text-muted-foreground mt-0.5 text-xs">
                      {preview.class_slug}
                    </p>

                    <div className="text-muted-foreground mt-3 space-y-1 text-xs">
                      <p className="flex items-center gap-1.5">
                        <ShieldCheck
                          aria-hidden="true"
                          className="text-accent h-3.5 w-3.5"
                        />
                        <span>Invited by {preview.inviter_name}</span>
                      </p>
                      {preview.expires_at ? (
                        <p className="flex items-center gap-1.5">
                          <Clock
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                          <span>
                            Valid until {formatDate(preview.expires_at)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <p className="text-muted-foreground text-xs leading-relaxed">
                  Accepting this link adds you as a member of this class group.
                  You will automatically gain access to all subjects and published
                  assignments within it.
                </p>

                {session ? (
                  <InviteAcceptButton token={parsed.data.token} />
                ) : (
                  <>
                    <Alert variant="info">
                      Sign in with Google to accept this invitation. The
                      membership will be tied to your signed-in account.
                    </Alert>
                    <Button
                      asChild
                      className="w-full"
                    >
                      <Link
                        href={buildLoginPath(`/invite/${parsed.data.token}`)}
                      >
                        Sign in to accept
                      </Link>
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
