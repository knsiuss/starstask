"use client";

import { useEffect, useState } from "react";

import { BackupKeyButton } from "@/components/messages/backup-key";
import {
  exportPublicKey,
  getOrCreateKeyPair,
  getSafetyFingerprint,
} from "@/lib/crypto/e2ee";
import { restorePrivateKey } from "@/lib/crypto/key-backup";

type Status = "pending" | "ready" | "error";

export function RestoreKeyButton() {
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState("");

  async function restore() {
    if (!passphrase) return;

    try {
      await restorePrivateKey(passphrase);
      setStatus("Key restored on this device. Refresh Messages to continue.");
      setPassphrase("");
    } catch {
      setStatus("Restore failed — check your passphrase and try again.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="password"
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
        placeholder="Recovery passphrase"
        aria-label="Recovery passphrase"
        autoComplete="off"
        className="border-border bg-surface min-w-52 flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <button
        type="button"
        className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => void restore()}
      >
        Restore on this device
      </button>
      {status ? (
        <span
          role="status"
          className="text-muted-foreground text-xs"
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}

export function SecurityPrivacyPanel() {
  const [status, setStatus] = useState<Status>("pending");
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const published = await fetch("/api/dm/keys/me").then((response) =>
          response.ok ? response.json() : Promise.reject(new Error("")),
        );
        const publicKeyValue =
          typeof published.publicKey === "string" ? published.publicKey : null;

        let value: string | null = publicKeyValue;

        if (!value) {
          const pair = await getOrCreateKeyPair();
          value = await exportPublicKey(pair);
          await fetch("/api/dm/keys/me", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey: value }),
          });
        }

        if (!cancelled && value) {
          setFingerprint(await getSafetyFingerprint(value));
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

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
        <p className="mt-2 text-sm">
          {status === "ready"
            ? "Status: Active on this device."
            : status === "error"
              ? "Status: Could not load. Reload the page to retry."
              : "Status: Setting up…"}
        </p>
      </section>

      <section aria-labelledby="device-key">
        <h2
          id="device-key"
          className="text-base font-semibold"
        >
          This device
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Each device has its own key. The private half never leaves this
          device. Compare the fingerprint below with the person you chat with to
          verify it is really them.
        </p>
        <p className="border-border bg-muted/50 mt-3 w-fit rounded-lg border px-3 py-2 font-mono text-xs tracking-widest">
          {fingerprint ?? "Loading fingerprint…"}
        </p>
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
          server stores the backup encrypted — it cannot read it.
        </p>
        <div className="mt-3">
          <BackupKeyButton />
        </div>
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
          On a new device, restore with the same passphrase.
        </p>
        <div className="mt-3">
          <RestoreKeyButton />
        </div>
      </section>

      <section aria-labelledby="sessions">
        <h2
          id="sessions"
          className="text-base font-semibold"
        >
          Devices &amp; sessions
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          You are signed in on this device. If you start using a new device,
          restore your key there with the passphrase above — no separate session
          list to manage.
        </p>
      </section>
    </div>
  );
}
