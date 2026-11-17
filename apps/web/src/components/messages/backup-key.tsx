"use client";

import { useState } from "react";

import { backupPrivateKey } from "@/lib/crypto/key-backup";

export function BackupKeyButton() {
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState("");

  async function backup() {
    if (!passphrase) return;

    try {
      await backupPrivateKey(passphrase);
      setStatus("Backup saved — the server cannot read it.");
      setPassphrase("");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Backup failed — try again.",
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="password"
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
        placeholder="Passphrase for backup (12+ chars)"
        aria-label="Passphrase for backup"
        autoComplete="off"
        minLength={12}
        className="border-border bg-surface min-w-52 flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <button
        type="button"
        className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => void backup()}
      >
        Back up key
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
