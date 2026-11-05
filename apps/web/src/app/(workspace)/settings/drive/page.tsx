import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { DriveConnectionSettings } from "@/components/settings/drive-connection-settings";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getDriveConnectionPublic } from "@/lib/db/google-drive-connections";
import { isGoogleDriveConfigured } from "@/lib/integrations/google/drive-config";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Drive settings",
  description: "Connect Google Drive for assignment submission.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const CALLBACK_ERRORS: Record<string, string> = {
  not_configured:
    "Google Drive is not configured on this deployment. Ask an administrator to add the Google Drive OAuth credentials.",
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
  rate_limited: "Too many connection attempts. Try again in a little while.",
};

type Props = {
  searchParams: Promise<{ connected?: string; error?: string }>;
};

export default async function DriveSettingsPage({ searchParams }: Props) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Drive settings
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const viewer = await getSessionUser();
  if (!viewer) {
    redirect(buildLoginPath("/settings/drive"));
  }

  const [connection, query] = await Promise.all([
    getDriveConnectionPublic(viewer.user.id),
    searchParams,
  ]);

  const errorMessage = query.error ? CALLBACK_ERRORS[query.error] : null;
  const connected = connection?.status === "connected";

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
          Drive settings
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Connect once and submit assignments straight from your Drive. Your
          lecturer receives a copy link and never needs a StarsTask account.
        </p>
      </header>

      {query.connected ? (
        <Alert
          variant="success"
          className="mt-6"
        >
          Google Drive is connected. Open an assignment and use “Submit from
          Google Drive”.
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
        <DriveConnectionSettings
          configured={isGoogleDriveConfigured()}
          connected={connected}
          driveEmail={connection?.driveEmail ?? null}
          connectedAt={connection?.connectedAt ?? null}
        />
      </div>

      <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
        StarsTask stores the Google tokens encrypted on the server and never
        sends them to your browser. Disconnecting deletes them.
      </p>
    </div>
  );
}
