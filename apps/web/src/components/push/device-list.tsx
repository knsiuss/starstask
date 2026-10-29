"use client";

import { Loader2, Trash2 } from "lucide-react";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PushDevice } from "@/lib/db/push";
import { formatDate } from "@starstask/shared";

type DeviceListProps = {
  devices: PushDevice[];
  onRemove: (deviceId: string) => Promise<void>;
};

export function DeviceList({ devices, onRemove }: DeviceListProps) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const remove = async (deviceId: string) => {
    setBusyId(deviceId);
    setError(null);

    try {
      await onRemove(deviceId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not remove this device.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <h2 className="text-base font-semibold">Active devices</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Each browser you enable appears here. Remove a device if you no longer
        use it; its push endpoint is deleted, not just muted.
      </p>

      {error ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          {error}
        </Alert>
      ) : null}

      {devices.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No devices registered yet. Enable notifications on the browser you
          want to use.
        </p>
      ) : (
        <ul className="divide-border border-border mt-4 divide-y rounded-md border">
          {devices.map((device) => (
            <li
              key={device.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {device.device_label ?? "Unnamed browser"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Added {formatDate(device.created_at)}
                  {device.last_success_at
                    ? ` · Last reminder ${formatDate(device.last_success_at)}`
                    : " · No reminder sent yet"}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busyId === device.id}
                aria-busy={busyId === device.id}
                onClick={() => void remove(device.id)}
              >
                {busyId === device.id ? (
                  <Loader2
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin"
                  />
                ) : (
                  <Trash2
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                )}
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
