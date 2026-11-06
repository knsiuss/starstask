"use client";

import { useEffect, useState } from "react";

import { exportPublicKey, getOrCreateKeyPair } from "@/lib/crypto/e2ee";

type KeyStatus = "pending" | "ready" | "error";

/**
 * Generates the device keypair on first login and publishes the public
 * half so peers can encrypt. The private half never leaves IndexedDB.
 * Mounted in WorkspaceLayout so it runs on the first workspace load
 * after sign-in, not just the DM tab. If a key is already published on
 * the server, setup is skipped — generation happens once, at first login.
 */
export function DmKeySetup() {
  const [status, setStatus] = useState<KeyStatus>("pending");

  useEffect(() => {
    let cancelled = false;

    async function setup(): Promise<void> {
      try {
        // First-login only: if the server already holds our public key,
        // there is nothing to generate or publish.
        const existing = await fetch("/api/dm/keys/me").then((response) =>
          response.ok
            ? (response.json() as Promise<{ publicKey: string | null }>)
            : Promise.resolve<{ publicKey: string | null }>({ publicKey: null }),
        );

        if (existing.publicKey) {
          if (!cancelled) {
            setStatus("ready");
          }
          return;
        }

        const pair = await getOrCreateKeyPair();
        const publicKey = await exportPublicKey(pair);
        const response = await fetch("/api/dm/keys/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey }),
        });

        if (!response.ok) {
          throw new Error("Key sync failed");
        }

        if (!cancelled) {
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    void setup();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "error") {
    return (
      <p
        role="alert"
        className="text-xs text-amber-600"
      >
        Encryption setup failed — reload to retry.
      </p>
    );
  }

  // Silent by design: key setup runs in the background while the Messages
  // workspace stays free of permanent encryption clutter. Status and recovery
  // controls live in Settings → Security & Privacy.
  return null;
}
