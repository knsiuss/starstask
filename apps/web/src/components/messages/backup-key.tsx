"use client";

import { useState } from "react";

import { backupPrivateKey, restorePrivateKey } from "@/lib/crypto/key-backup";

type BackupKeyButtonProps = {
  disabled?: boolean;
};

export function BackupKeyButton({ disabled = false }: BackupKeyButtonProps) {
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function backup() {
    if (!passphrase || isSaving || disabled) return;

    setIsSaving(true);
    setStatus("");

    try {
      await backupPrivateKey(passphrase);
      setStatus("Backup saved. The server only stores encrypted key data.");
      setPassphrase("");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Backup failed. Try again.",
      );
    } finally {
      setIsSaving(false);
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
        disabled={disabled || isSaving}
        className="border-border bg-surface min-w-52 flex-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <button
        type="button"
        disabled={disabled || isSaving || passphrase.length === 0}
        className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => void backup()}
      >
        {isSaving ? "Saving..." : "Back up key"}
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

export function RestoreKeyButton({ onRestored }: { onRestored?: () => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  async function restore() {
    if (!passphrase || isRestoring) return;

    setIsRestoring(true);
    setStatus("");

    try {
      await restorePrivateKey(passphrase);
      setStatus("Key restored on this device.");
      setPassphrase("");
      onRestored?.();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Restore failed. Check your passphrase and try again.",
      );
    } finally {
      setIsRestoring(false);
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
        disabled={isRestoring}
        className="border-border bg-surface min-w-52 flex-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <button
        type="button"
        disabled={isRestoring || passphrase.length === 0}
        className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => void restore()}
      >
        {isRestoring ? "Restoring..." : "Restore on this device"}
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
