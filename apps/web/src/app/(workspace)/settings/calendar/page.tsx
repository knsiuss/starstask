import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { CalendarConnectionSettings } from "@/components/settings/calendar-connection-settings";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { getCalendarConnectionSummary } from "@/features/integrations/google-calendar-service";

export const metadata: Metadata = {
  title: "Calendar settings",
  description: "Connect Google Calendar to copy your sessions into it.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The callback redirects here with a machine code, never with a token or an
 * upstream message, so the copy below is the only thing the user sees.
 */
const CALLBACK_ERRORS: Record<string, string> = {
  not_configured:
    "Google Calendar sync is not configured on this deployment. Ask an administrator to add the Google OAuth credentials.",
  session_expired:
    "Your StarsTask session expired before Google answered. Sign in again and retry.",
  invalid_state:
    "That connection attempt could not be verified, so it was rejected. Start again from this page.",
  cancelled: "You cancelled the Google consent screen. Nothing was changed.",
  callback_failed:
    "Google did not complete the connection. Try again, or check the server logs.",
  transient: "Google was temporarily unavailable. Try again in a moment.",
  storage_failed:
    "Google answered, but the connection could not be stored. Try again.",
};

type CalendarSettingsPageProps = {
  searchParams: Promise<{ connected?: string; error?: string }>;
};

export default async function CalendarSettingsPage({
  searchParams,
}: CalendarSettingsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Calendar settings
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const viewer = await getSessionUser();

  if (!viewer) {
    redirect(buildLoginPath("/settings/calendar"));
  }

  const [summary, query] = await Promise.all([
    getCalendarConnectionSummary(viewer.user.id),
    searchParams,
  ]);

  const errorMessage = query.error ? CALLBACK_ERRORS[query.error] : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/settings/notifications"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Notification settings
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Calendar settings
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Connecting is optional. Without it you can still add any session to
          Google Calendar with a single link.
        </p>
      </header>

      {query.connected ? (
        <Alert
          variant="success"
          className="mt-6"
        >
          Google Calendar is connected. Open a session and use &quot;Add to my
          Google Calendar&quot; to copy it across.
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert
          variant="error"
          className="mt-6"
        >
          {errorMessage}
        </Alert>
      ) : null}

      <div className="mt-6">
        <CalendarConnectionSettings
          configured={summary.configured}
          connected={summary.connected}
          calendarId={summary.calendarId}
          connectedAt={summary.connectedAt}
          lastErrorCategory={summary.lastErrorCategory}
        />
      </div>

      <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
        StarsTask stores the Google tokens encrypted on the server and never
        sends them to your browser. Disconnecting deletes them. Session
        reminders are separate and are managed in{" "}
        <Link
          href="/settings/notifications"
          className="text-accent hover:underline"
        >
          notification settings
        </Link>
        .
      </p>
    </div>
  );
}
