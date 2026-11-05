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
      setStatus("Backup tersimpan (wrapped, server tidak bisa baca)");
    } catch {
      setStatus("Backup gagal");
    }
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        type="password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        placeholder="Passphrase backup kunci"
        className="rounded border px-2 py-1 text-sm"
      />
      <button
        type="button"
        className="rounded border px-2 py-1 text-sm"
        onClick={() => void backup()}
      >
        Backup kunci (multi-device)
      </button>
      {status ? <span className="text-xs">{status}</span> : null}
    </div>
  );
}
