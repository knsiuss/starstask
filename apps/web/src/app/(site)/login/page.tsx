import { ArrowLeft, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { resolveSignedInHomePath } from "@/lib/auth/developer";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { safeRedirectPath } from "@/lib/security/redirect";

// Session state must be read per request, never frozen at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with Google to browse and contribute assignments.",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  oauth_cancelled:
    "Google sign-in was cancelled. You can try again whenever you are ready.",
  callback_failed: "We could not complete sign-in. Please try again.",
  rate_limited: "Too many sign-in attempts. Wait a few minutes and try again.",
  not_configured: "Supabase authentication is not configured yet.",
};

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const session = configured ? await getSessionUser() : null;
  // Without an explicit `next`, each account kind lands in its own home area.
  const nextPath = safeRedirectPath(
    params.next,
    resolveSignedInHomePath(session?.user.email),
  );

  if (session) {
    // A signed-in user with an unfinished profile goes to onboarding once here,
    // rather than being bounced by the workspace layout.
    if (session.profile && !session.profile.onboarded_at) {
      redirect(`/onboarding?next=${encodeURIComponent(nextPath)}`);
    }

    redirect(nextPath);
  }

  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : undefined;

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <Link
        href="/assignments"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to assignments
      </Link>

      <div className="border-border mt-6 rounded-lg border p-6 shadow-[0_1px_2px_rgba(9,9,11,0.04)] sm:p-8">
        <span className="bg-accent text-accent-foreground flex h-10 w-10 items-center justify-center rounded-md">
          <Star
            aria-hidden="true"
            className="h-5 w-5"
          />
        </span>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Sign in to StarsTask
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Google is the only sign-in method. You need an account to browse,
          submit, and manage assignments.
        </p>

        {errorMessage ? (
          <Alert
            variant="error"
            className="mt-5"
          >
            {errorMessage}
          </Alert>
        ) : null}

        <div className="mt-6">
          {configured ? (
            <GoogleSignInButton nextPath={nextPath} />
          ) : (
            <SetupNotice />
          )}
        </div>

        <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
          We receive your name, avatar, and email address from Google. Only your
          name and avatar are stored in your public contributor profile. We
          never see your Google password.
        </p>
      </div>
    </div>
  );
}
