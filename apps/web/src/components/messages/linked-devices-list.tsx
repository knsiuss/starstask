"use client";

import { useState } from "react";
import { Laptop, Trash2 } from "lucide-react";

export type LinkedDevice = {
  deviceId: string;
  deviceLabel: string;
  lastActiveAt: string | null;
};

type LinkedDevicesListProps = {
  isLoading: boolean;
  devices: LinkedDevice[];
  currentDeviceId: string | null;
  deviceError: string | null;
  onError: (message: string | null) => void;
  onDeviceRevoked: (deviceId: string) => void;
};

export function normalizeDevices(payload: unknown): LinkedDevice[] {
  const obj =
    payload && typeof payload === "object"
      ? (payload as { devices?: unknown })
      : null;
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(obj?.devices)
      ? obj.devices
      : [];

  return raw
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .filter((item) => !item.revokedAt && !item.revoked_at)
    .map((item) => {
      const id = item.deviceId ?? item.device_id;
      const lbl = item.deviceLabel ?? item.device_label ?? item.label;
      const ts =
        item.lastActiveAt ??
        item.last_active_at ??
        item.updatedAt ??
        item.updated_at ??
        item.createdAt ??
        item.created_at;

      return {
        deviceId: typeof id === "string" ? id.trim() : "",
        deviceLabel:
          typeof lbl === "string" && lbl.trim() ? lbl.trim() : "Unknown device",
        lastActiveAt: typeof ts === "string" ? ts : null,
      };
    })
    .filter((device) => device.deviceId.length > 0);
}

function formatLastActive(value: string | null): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Active recently";

  return `Last active ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function LinkedDevicesList({
  isLoading,
  devices,
  currentDeviceId,
  deviceError,
  onError,
  onDeviceRevoked,
}: LinkedDevicesListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevokeDevice(deviceId: string) {
    setRevokingId(deviceId);
    onError(null);
    try {
      const res = await fetch(
        `/api/dm/devices/${encodeURIComponent(deviceId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Could not revoke device.");
      onDeviceRevoked(deviceId);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not revoke device.",
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section aria-labelledby="linked-devices">
      <h2
        id="linked-devices"
        className="text-base font-semibold"
      >
        Linked devices
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Manage browsers and devices registered for end-to-end encrypted
        messages.
      </p>
      {deviceError ? (
        <p
          role="alert"
          className="text-destructive mt-2 text-xs"
        >
          {deviceError}
        </p>
      ) : null}
      {isLoading ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Loading linked devices...
        </p>
      ) : devices.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">
          No linked devices registered yet.
        </p>
      ) : (
        <ul className="border-border divide-border mt-3 divide-y rounded-xl border">
          {devices.map((device) => {
            const isCurrent = device.deviceId === currentDeviceId;
            const isRevoking = revokingId === device.deviceId;

            return (
              <li
                key={device.deviceId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Laptop className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {device.deviceLabel}
                      </span>
                      {isCurrent ? (
                        <span className="bg-accent-soft text-accent rounded-md px-2 py-0.5 text-[11px] font-semibold">
                          This device
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatLastActive(device.lastActiveAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRevoking}
                  onClick={() => void handleRevokeDevice(device.deviceId)}
                  aria-label={`Revoke ${device.deviceLabel}`}
                  className="border-border hover:bg-muted/60 inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Trash2 className="size-3.5" />
                  {isRevoking ? "Revoking..." : "Revoke"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
