"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import type { NotificationPreferences } from "@/lib/db/push";
import { COMMON_NOTIFICATION_TIMEZONES } from "@starstask/contracts";

type ReminderPreferencesProps = {
  preferences: NotificationPreferences;
  onChange: (preferences: NotificationPreferences) => void;
  onError: (message: string | null) => void;
};

export function ReminderPreferences({
  preferences,
  onChange,
  onError,
}: ReminderPreferencesProps) {
  const [isSaving, setIsSaving] = React.useState(false);

  const update = async (patch: Partial<NotificationPreferences>) => {
    const previous = preferences;
    onChange({ ...preferences, ...patch });
    onError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/push/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        onChange(previous);
        onError(body?.error?.message ?? "Could not save that preference.");
        return;
      }

      const body = (await response.json()) as {
        data: { preferences: NotificationPreferences };
      };
      onChange(body.data.preferences);
    } catch {
      onChange(previous);
      onError("Network error. Your preference was not saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const timezoneOptions = React.useMemo(() => {
    const zones = new Set<string>(COMMON_NOTIFICATION_TIMEZONES);

    zones.add(preferences.timezone);

    return [...zones];
  }, [preferences.timezone]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Reminder preferences</h2>
        {isSaving ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
            Saving...
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Reminders are sent for assignments you own or save. They apply only
        while notifications are enabled.
      </p>

      {!preferences.pushEnabled ? (
        <Alert className="mt-4">
          Notifications are currently off. Turn them on above before choosing
          reminder windows.
        </Alert>
      ) : null}

      <fieldset
        className="mt-4 space-y-3"
        disabled={isSaving}
      >
        <legend className="sr-only">Reminder windows</legend>
        <ToggleRow
          label="24 hours before the deadline"
          description="A reminder the day before, using your time zone."
          checked={preferences.reminder24h}
          onChange={(checked) => void update({ reminder24h: checked })}
        />
        <ToggleRow
          label="3 hours before the deadline"
          description="A shorter warning on the deadline day."
          checked={preferences.reminder3h}
          onChange={(checked) => void update({ reminder3h: checked })}
        />
      </fieldset>

      <div className="mt-5">
        <label
          htmlFor="notification-timezone"
          className="text-sm font-medium"
        >
          Time zone
        </label>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Deadlines are stored as instants; this zone is used to phrase the
          reminder.
        </p>
        <select
          id="notification-timezone"
          value={preferences.timezone}
          disabled={isSaving}
          onChange={(event) => void update({ timezone: event.target.value })}
          className="border-input bg-background focus-visible:outline-accent mt-2 h-10 w-full max-w-xs rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {timezoneOptions.map((zone) => (
            <option
              key={zone}
              value={zone}
            >
              {zone}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="border-border flex cursor-pointer items-start gap-3 rounded-md border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-accent mt-0.5 h-4 w-4"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block text-xs">
          {description}
        </span>
      </span>
    </label>
  );
}
