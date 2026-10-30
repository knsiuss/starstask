import { ArrowLeft, MailPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/classes/join"));
  }

  const rawParams = await searchParams;
  const submitted =
    typeof rawParams.invitation === "string" ? rawParams.invitation : "";
  const token = submitted ? extractInvitationToken(submitted) : null;

  if (token) {
    redirect(`/invite/${encodeURIComponent(token)}`);
  }

  const showInvalid = submitted !== "" && token === null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 lg:py-10">
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
          <MailPlus
            aria-hidden="true"
            className="h-5 w-5"
          />
        </span>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Join a class
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Paste the invitation link a class admin sent you. Accepting it adds
          you as a class member only — it never grants class admin or platform
          admin permissions.
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

        <form
          method="get"
          action="/classes/join"
          className="mt-6 space-y-2"
        >
          <Label htmlFor="invitation">Invitation link</Label>
          <Input
            id="invitation"
            name="invitation"
            type="text"
            required
            defaultValue={submitted}
            placeholder="https://starstask.app/invite/..."
            aria-invalid={showInvalid}
            className="h-11"
          />
          <p className="text-muted-foreground text-xs">
            The link must be opened with the same Google account the admin
            invited.
          </p>
          <Button
            type="submit"
            className="mt-2 h-11 px-6"
          >
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
