import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { NotificationSettings } from "@/components/push/notification-settings";
import { getSessionUser } from "@/lib/auth/session";
import {
  getNotificationPreferences,
  listPushDevices,
  listSavedAssignments,
} from "@/lib/db/push";
import { isSupabaseConfigured } from "@/lib/env/public";
import { getPushConfig } from "@/lib/push/config";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Notification settings",
  description: "Choose how StarsTask reminds you about assignment deadlines.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Notification settings
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/settings/notifications"));
  }

  const [preferences, devices, saved] = await Promise.all([
    getNotificationPreferences(session.user.id),
    listPushDevices(session.user.id),
    listSavedAssignments(session.user.id),
  ]);

  // Only the public VAPID key crosses to the browser. The private key stays in
  // the scheduler process and is never part of this payload.
  const publicKey = getPushConfig()?.publicKey ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Notification settings
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Get a reminder about 24 hours and 3 hours before an assignment you own
          or save is due. Notifications are optional and never change what is
          public.
        </p>
      </header>

      <div className="mt-8">
        <NotificationSettings
          vapidPublicKey={publicKey}
          initialPreferences={preferences}
          initialDevices={devices}
          initialSaved={saved}
        />
      </div>

      <p className="text-muted-foreground mt-6 text-xs">
        Deadline reminders follow the timezone and lead time saved above. They
        are delivered to your saved push devices whether or not a calendar is
        connected.
      </p>
    </div>
  );
}
