"use client";

import { useEffect, useState } from "react";

import { exportPublicKey, getOrCreateKeyPair } from "@/lib/crypto/e2ee";

type KeyStatus = "pending" | "ready" | "error";

/**
 * Generates the device keypair on first use and publishes the public
 * half so peers can encrypt. The private half never leaves IndexedDB.
 */
export function DmKeySetup() {
  const [status, setStatus] = useState<KeyStatus>("pending");

  useEffect(() => {
    let cancelled = false;

    async function setup(): Promise<void> {
      try {
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

  if (status === "ready") {
    return (
      <p className="text-muted-foreground text-xs">🔒 End-to-end encrypted</p>
    );
  }

  if (status === "error") {
    return (
      <p className="text-xs text-amber-600">
        Encryption setup failed — reload to retry.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-xs">Setting up encryption…</p>
  );
}
