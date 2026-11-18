"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  BackupKeyButton,
  RestoreKeyButton,
} from "@/components/messages/backup-key";
import {
  LinkedDevicesList,
  normalizeDevices,
  type LinkedDevice,
} from "@/components/messages/linked-devices-list";
import {
  exportPublicKey,
  getLocalKeyPairIfPresent,
  getOrCreateDeviceId,
  getOrCreateKeyPair,
  getSafetyFingerprint,
} from "@/lib/crypto/e2ee";
import { registerCurrentDevice } from "@/lib/crypto/key-backup";

export { RestoreKeyButton };

type PanelStatus = "pending" | "ready" | "missing_local_key" | "error";
type SecurityState = {
  status: PanelStatus;
  fingerprint: string | null;
  currentDeviceId: string | null;
  devices: LinkedDevice[];
};

const INITIAL_STATE: SecurityState = {
  status: "pending",
  fingerprint: null,
  currentDeviceId: null,
  devices: [],
};

async function fetchSecurityState(): Promise<SecurityState> {
  try {
    const [keyRes, devRes, localPair] = await Promise.all([
      fetch("/api/dm/keys/me"),
      fetch("/api/dm/devices"),
      getLocalKeyPairIfPresent(),
    ]);
    if (!keyRes.ok) throw new Error("Failed");
    const keyData = (await keyRes.json()) as { publicKey?: unknown };
    const serverKey =
      typeof keyData.publicKey === "string" ? keyData.publicKey : null;
    const serverDevices = devRes.ok
      ? normalizeDevices(await devRes.json())
      : [];
    const deviceId = await getOrCreateDeviceId();

    if (!localPair && (serverKey || serverDevices.length > 0)) {
      return {
        status: "missing_local_key",
        fingerprint: serverKey ? await getSafetyFingerprint(serverKey) : null,
        currentDeviceId: deviceId,
        devices: serverDevices,
      };
    }

    const activePair = localPair ?? (await getOrCreateKeyPair());
    const publicKey = await exportPublicKey(activePair);
    if (!serverKey) {
      const putRes = await fetch("/api/dm/keys/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey }),
      });
      if (!putRes.ok) throw new Error("Failed");
    }

    let devices = serverDevices;
    if (!serverDevices.some((d) => d.deviceId === deviceId)) {
      await registerCurrentDevice(deviceId, publicKey);
      const refreshed = await fetch("/api/dm/devices");
      if (refreshed.ok) devices = normalizeDevices(await refreshed.json());
    }

    return {
      status: "ready",
      fingerprint: await getSafetyFingerprint(publicKey),
      currentDeviceId: deviceId,
      devices,
    };
  } catch {
    return { ...INITIAL_STATE, status: "error" };
  }
}

export function SecurityPrivacyPanel() {
  const [state, setState] = useState<SecurityState>(INITIAL_STATE);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadState = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "pending" }));
    setDeviceError(null);
    setState(await fetchSecurityState());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchSecurityState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRegisterThisDevice() {
    setIsRegistering(true);
    setDeviceError(null);
    try {
      const pair = await getOrCreateKeyPair();
      const publicKey = await exportPublicKey(pair);
      const deviceId = await getOrCreateDeviceId();
      const putRes = await fetch("/api/dm/keys/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey }),
      });
      if (!putRes.ok) throw new Error("Failed to publish public key.");
      await registerCurrentDevice(deviceId, publicKey);
      await loadState();
    } catch (error) {
      setDeviceError(
        error instanceof Error
          ? error.message
          : "Could not register this device.",
      );
    } finally {
      setIsRegistering(false);
    }
  }

  function handleDeviceRevoked(deviceId: string) {
    setState((prev) => ({
      ...prev,
      devices: prev.devices.filter((d) => d.deviceId !== deviceId),
    }));
  }

  async function handleCopyFingerprint() {
    if (!state.fingerprint) return;
    try {
      await navigator.clipboard.writeText(state.fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setDeviceError("Clipboard access is unavailable in this browser.");
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="encryption-status">
        <h2
          id="encryption-status"
          className="text-base font-semibold"
        >
          End-to-end encryption
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Your messages are protected with end-to-end encryption. Only you and
          the people you chat with can read them.
        </p>
        {state.status === "ready" ? (
          <p className="text-success mt-3 flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 shrink-0" />
            <span>Status: Active on this device.</span>
          </p>
        ) : state.status === "missing_local_key" ? (
          <div
            role="alert"
            className="border-border bg-muted/40 mt-3 space-y-3 rounded-xl border p-4"
          >
            <div className="flex items-start gap-2.5 text-sm">
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Key missing on this device</p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  Your account has an encryption key elsewhere, but no private
                  key is stored in this browser. Restore your backup below or
                  register this device.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isRegistering}
              onClick={() => void handleRegisterThisDevice()}
              className="rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {isRegistering ? "Registering..." : "Register this device"}
            </button>
          </div>
        ) : state.status === "error" ? (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="text-destructive">
              Status: Could not load encryption status.
            </span>
            <button
              type="button"
              onClick={() => void loadState()}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            Status: Checking device keys...
          </p>
        )}
      </section>

      <section aria-labelledby="device-key">
        <h2
          id="device-key"
          className="text-base font-semibold"
        >
          Safety fingerprint
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Each device has its own key. Compare this fingerprint with the person
          you chat with to verify your connection.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="border-border bg-muted/50 rounded-lg border px-3 py-2 font-mono text-xs tracking-widest">
            {state.fingerprint ?? "Unavailable"}
          </p>
          {state.fingerprint ? (
            <button
              type="button"
              onClick={() => void handleCopyFingerprint()}
              aria-label="Copy safety fingerprint"
              className="border-border hover:bg-muted/60 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="recovery">
        <h2
          id="recovery"
          className="text-base font-semibold"
        >
          Backup &amp; recovery
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Back up your key with a passphrase to use on another device. The
          server stores the backup encrypted and cannot read it.
        </p>
        <div className="mt-3">
          <BackupKeyButton disabled={state.status !== "ready"} />
        </div>
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
          On a new device, restore with the same passphrase.
        </p>
        <div className="mt-3">
          <RestoreKeyButton onRestored={() => void loadState()} />
        </div>
      </section>

      <LinkedDevicesList
        isLoading={state.status === "pending"}
        devices={state.devices}
        currentDeviceId={state.currentDeviceId}
        deviceError={deviceError}
        onError={setDeviceError}
        onDeviceRevoked={handleDeviceRevoked}
      />
    </div>
  );
}
