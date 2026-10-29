"use client";

import { Bell, BellOff, Loader2, Smartphone } from "lucide-react";
import * as React from "react";

import { DeviceList } from "@/components/push/device-list";
import { ReminderPreferences } from "@/components/push/reminder-preferences";
import { SavedAssignmentList } from "@/components/push/saved-assignment-list";
import {
  notifyPermissionChanged,
  useNotificationPermission,
  usePushEnvironment,
} from "@/components/push/use-browser-push";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  describePushSupport,
  getPushSupportStatus,
  urlBase64ToUint8Array,
  type NotificationPermissionState,
  type PushEnvironment,
} from "@/lib/push/capabilities";
import { registerServiceWorker } from "@/lib/push/service-worker";
import type {
  NotificationPreferences,
  PushDevice,
  SavedAssignmentSummary,
} from "@/lib/db/push";

type SubscriptionState =
  "checking" | "subscribed" | "not_subscribed" | "unavailable";

type NotificationSettingsProps = {
  vapidPublicKey: string | null;
  initialPreferences: NotificationPreferences;
  initialDevices: PushDevice[];
  initialSaved: SavedAssignmentSummary[];
};

export function NotificationSettings({
  vapidPublicKey,
  initialPreferences,
  initialDevices,
  initialSaved,
}: NotificationSettingsProps) {
  const environment = usePushEnvironment();
  const permission = useNotificationPermission();
  const [subscription, setSubscription] = React.useState<
    PushSubscription | null | undefined
  >(undefined);
  const [preferences, setPreferences] = React.useState(initialPreferences);
  const [devices, setDevices] = React.useState(initialDevices);
  const [saved, setSaved] = React.useState(initialSaved);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const canUsePush =
    environment !== null && getPushSupportStatus(environment) === "supported";

  React.useEffect(() => {
    if (!vapidPublicKey || !canUsePush) {
      return;
    }

    let isActive = true;

    void (async () => {
      const registration = await registerServiceWorker();
      const existing =
        (await registration?.pushManager.getSubscription()) ?? null;

      if (isActive) {
        setSubscription(existing);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [canUsePush, vapidPublicKey]);

  const supportStatus = environment ? getPushSupportStatus(environment) : null;
  const supportCopy = supportStatus ? describePushSupport(supportStatus) : null;
  const subscriptionState = resolveSubscriptionState({
    environment,
    hasKey: Boolean(vapidPublicKey),
    subscription,
  });
  const canEnable =
    supportCopy?.canEnable === true &&
    subscriptionState === "not_subscribed" &&
    permission !== "denied" &&
    Boolean(vapidPublicKey);

  const refresh = async () => {
    const response = await fetch("/api/push/preferences", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as {
      data: { preferences: NotificationPreferences; devices: PushDevice[] };
    };

    setPreferences(body.data.preferences);
    setDevices(body.data.devices);
  };

  const handleEnable = async () => {
    if (!vapidPublicKey || isBusy) {
      return;
    }

    setIsBusy(true);
    setError(null);
    setNotice(null);

    try {
      const registration = await registerServiceWorker();

      if (!registration) {
        setError("This browser could not start the notification worker.");
        return;
      }

      // Permission is requested only from this click, never on page load.
      const result = await Notification.requestPermission();
      notifyPermissionChanged();

      if (result !== "granted") {
        setError(
          "Notifications were not allowed. Change the permission in your browser settings, then try again.",
        );
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const serialized = subscription.toJSON();

      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: serialized.endpoint,
          keys: serialized.keys,
          deviceLabel: describeDevice(),
        }),
      });

      if (!response.ok) {
        // Never leave a browser subscription that the server does not know.
        await subscription.unsubscribe().catch(() => undefined);
        setError(await readErrorMessage(response));
        return;
      }

      const prefResponse = await fetch("/api/push/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushEnabled: true }),
      });

      if (!prefResponse.ok) {
        setError(await readErrorMessage(prefResponse));
        return;
      }

      setPreferences((current) => ({ ...current, pushEnabled: true }));
      setSubscription(subscription);
      await refresh();
      setNotice("Notifications are on for this device.");
    } catch {
      setError("Could not enable notifications on this browser.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisable = async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setError(null);
    setNotice(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const activeSubscription =
        await registration.pushManager.getSubscription();

      if (activeSubscription) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: activeSubscription.endpoint }),
        });

        if (!response.ok) {
          setError(await readErrorMessage(response));
          return;
        }

        await activeSubscription.unsubscribe();
      }

      const prefResponse = await fetch("/api/push/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushEnabled: false }),
      });

      if (!prefResponse.ok) {
        setError(await readErrorMessage(prefResponse));
        return;
      }

      setPreferences((current) => ({ ...current, pushEnabled: false }));
      setSubscription(null);
      await refresh();
      setNotice(
        "Notifications are off. You can turn them back on at any time.",
      );
    } catch {
      setError("Could not turn notifications off. Try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    const response = await fetch(`/api/push/subscriptions/${deviceId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const remaining = devices.filter((device) => device.id !== deviceId);
    setDevices(remaining);

    // Removing the last known device means this browser is no longer covered.
    if (remaining.length === 0 && subscriptionState === "subscribed") {
      const registration = await navigator.serviceWorker.ready;
      const activeSubscription =
        await registration.pushManager.getSubscription();
      await activeSubscription?.unsubscribe().catch(() => undefined);
      setSubscription(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Browser notifications</h2>
              <StatusBadge
                subscriptionState={subscriptionState}
                permission={permission}
                hasKey={Boolean(vapidPublicKey)}
              />
            </div>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm">
              {supportCopy?.description ??
                "Checking whether this browser can receive deadline reminders."}
            </p>
            {!vapidPublicKey ? (
              <p className="text-muted-foreground mt-2 max-w-xl text-sm">
                This deployment has no VAPID keys configured, so notifications
                cannot be enabled yet.
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 gap-2">
            {subscriptionState === "subscribed" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleDisable}
                disabled={isBusy}
                aria-busy={isBusy}
              >
                {isBusy ? (
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                ) : (
                  <BellOff
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                )}
                Disable notifications
              </Button>
            ) : null}
            {canEnable ? (
              <Button
                type="button"
                onClick={handleEnable}
                disabled={isBusy}
                aria-busy={isBusy}
              >
                {isBusy ? (
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                ) : (
                  <Bell
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                )}
                Enable notifications
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <Alert
            variant="error"
            className="mt-4"
          >
            {error}
          </Alert>
        ) : null}
        {notice ? (
          <Alert
            variant="success"
            className="mt-4"
          >
            {notice}
          </Alert>
        ) : null}

        {permission === "denied" ? (
          <Alert
            variant="warning"
            className="mt-4"
          >
            <p className="font-medium">
              Notifications are blocked for StarsTask.
            </p>
            <p className="mt-1">
              Open your browser&apos;s site settings for this domain, allow
              notifications, then reload this page. StarsTask will not ask again
              until you change that setting.
            </p>
          </Alert>
        ) : null}

        {supportStatus === "ios_needs_install" ? <IosInstallGuide /> : null}
      </Card>

      <ReminderPreferences
        preferences={preferences}
        onChange={setPreferences}
        onError={setError}
      />

      <DeviceList
        devices={devices}
        onRemove={handleRemoveDevice}
      />

      <SavedAssignmentList
        saved={saved}
        onRemoved={setSaved}
      />

      <details className="border-border rounded-lg border p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Not receiving reminders?
        </summary>
        <ul className="text-muted-foreground mt-3 list-disc space-y-2 pl-5 text-sm">
          <li>
            Check that notifications are enabled for StarsTask in your operating
            system, not only in the browser.
          </li>
          <li>
            Reminders are sent about 24 hours and 3 hours before a deadline, so
            a deadline added inside that window may only produce the later
            reminder.
          </li>
          <li>
            Battery saver and focus modes can delay delivery. Open StarsTask
            once to confirm the device is still registered.
          </li>
          <li>
            If you removed the site data, enable notifications again to register
            this browser.
          </li>
        </ul>
      </details>
    </div>
  );
}

function resolveSubscriptionState({
  environment,
  hasKey,
  subscription,
}: {
  environment: PushEnvironment | null;
  hasKey: boolean;
  subscription: PushSubscription | null | undefined;
}): SubscriptionState {
  if (!environment) {
    return "checking";
  }

  if (getPushSupportStatus(environment) !== "supported" || !hasKey) {
    return "unavailable";
  }

  // `undefined` means the initial probe has not finished yet.
  if (subscription === undefined) {
    return "checking";
  }

  return subscription ? "subscribed" : "not_subscribed";
}

function StatusBadge({
  subscriptionState,
  permission,
  hasKey,
}: {
  subscriptionState: SubscriptionState;
  permission: NotificationPermissionState;
  hasKey: boolean;
}) {
  if (!hasKey) {
    return <Badge variant="warning">Not configured</Badge>;
  }

  if (subscriptionState === "checking") {
    return <Badge>Checking...</Badge>;
  }

  if (permission === "denied") {
    return <Badge variant="danger">Blocked</Badge>;
  }

  if (subscriptionState === "subscribed") {
    return <Badge variant="success">On for this device</Badge>;
  }

  if (subscriptionState === "unavailable") {
    return <Badge variant="warning">Unsupported here</Badge>;
  }

  return <Badge>Off</Badge>;
}

function IosInstallGuide() {
  return (
    <div className="border-border bg-subtle mt-4 rounded-md border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Smartphone
          aria-hidden="true"
          className="h-4 w-4"
        />
        Add StarsTask to your Home Screen
      </p>
      <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-sm">
        <li>Open StarsTask in Safari.</li>
        <li>Tap the Share button.</li>
        <li>Choose Add to Home Screen.</li>
        <li>Launch StarsTask from its new Home Screen icon.</li>
        <li>Sign in with Google.</li>
        <li>Return to Notification settings.</li>
        <li>Enable notifications and allow the permission prompt.</li>
      </ol>
      <p className="text-muted-foreground mt-2 text-xs">
        iPhone and iPad only expose Web Push to web apps opened from the Home
        Screen, on iOS or iPadOS 16.4 and later.
      </p>
    </div>
  );
}

function describeDevice(): string {
  const userAgent = navigator.userAgent;

  return `${detectBrowser(userAgent)} on ${detectPlatform(userAgent)}`.slice(
    0,
    60,
  );
}

function detectPlatform(userAgent: string): string {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return "iPhone/iPad";
  }

  if (/Android/.test(userAgent)) {
    return "Android";
  }

  if (/Macintosh/.test(userAgent)) {
    return "Mac";
  }

  if (/Windows/.test(userAgent)) {
    return "Windows";
  }

  if (/Linux/.test(userAgent)) {
    return "Linux";
  }

  return "Browser";
}

function detectBrowser(userAgent: string): string {
  if (/Edg\//.test(userAgent)) {
    return "Edge";
  }

  if (/Chrome\//.test(userAgent)) {
    return "Chrome";
  }

  if (/Firefox\//.test(userAgent)) {
    return "Firefox";
  }

  if (/Safari\//.test(userAgent)) {
    return "Safari";
  }

  return "Browser";
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;

  return body?.error?.message ?? "Something went wrong. Please try again.";
}
