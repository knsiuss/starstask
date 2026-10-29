import { MailPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InviteAcceptButton } from "@/components/classes/invite-accept-button";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { classInvitationAcceptSchema } from "@starstask/contracts";

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

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
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
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Accepting this link adds you as a class member. It does not grant
          class admin or platform admin permissions, and class admins can remove
          members at any time.
        </p>

        <div className="mt-6">
          {!parsed.success ? (
            <Alert variant="error">
              This invitation link is incomplete. Ask the class admin to send a
              new link.
            </Alert>
          ) : session ? (
            <InviteAcceptButton token={parsed.data.token} />
          ) : (
            <div className="space-y-3">
              <Alert variant="info">
                Sign in with Google to accept this invitation. The link is tied
                to the account you sign in with.
              </Alert>
              <Button asChild>
                <Link href={buildLoginPath(`/invite/${parsed.data.token}`)}>
                  Sign in to accept
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
