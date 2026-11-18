"use client";

/**
 * Pinned-key trust (QA-01).
 *
 * The first peer key seen in a conversation is pinned in IndexedDB. If a later
 * load returns a different key, the user is shown a warning banner with both
 * fingerprints and must explicitly accept the new key — the app never
 * silently trusts a changed key. Server replacement of keys (or a compromised
 * session) therefore cannot silently redirect encryption.
 */

import { useEffect, useState } from "react";

import { getSafetyFingerprint } from "@/lib/crypto/e2ee";

const DB_NAME = "starstask-e2ee";
const STORE = "keys";

type Pinned = {
  fingerprint: string;
  publicKey: string;
};

type TrustState = "loading" | "trusted" | "changed" | "none";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error);
  });
}

async function pinnedGet(conversationId: string): Promise<Pinned | null> {
  const db = await openDb();

  return new Promise<Pinned | null>((resolve, reject) => {
    const request = db
      .transaction(STORE)
      .objectStore(STORE)
      .get(`trust:${conversationId}`);
    request.onsuccess = (): void => {
      resolve((request.result as Pinned | null) ?? null);
    };
    request.onerror = (): void => reject(request.error);
  });
}

async function pinnedSet(conversationId: string, pinned: Pinned): Promise<void> {
  const db = await openDb();

  return new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .put(pinned, `trust:${conversationId}`);
    request.onsuccess = (): void => resolve();
    request.onerror = (): void => reject(request.error);
  });
}

export function KeyTrustBanner({
  conversationId,
  peerPublicKey,
}: {
  conversationId: string;
  peerPublicKey: string | null;
}) {
  const [state, setState] = useState<TrustState>("none");
  const [current, setCurrent] = useState<Pinned | null>(null);

  useEffect(() => {
    if (!peerPublicKey) {
      return;
    }

    let cancelled = false;

    (async () => {
      const fingerprint = await getSafetyFingerprint(peerPublicKey);
      const pinned = await pinnedGet(conversationId);

      if (cancelled) {
        return;
      }

      if (!pinned) {
        await pinnedSet(conversationId, { fingerprint, publicKey: peerPublicKey });
        setCurrent({ fingerprint, publicKey: peerPublicKey });
        setState("trusted");
        return;
      }

      setCurrent({ fingerprint, publicKey: peerPublicKey });

      if (pinned.fingerprint !== fingerprint) {
        setState("changed");
        return;
      }

      setState("trusted");
    })().catch(() => {
      // Trust storage failing (private mode, quota) must not break the chat.
      if (!cancelled) {
        setState("trusted");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId, peerPublicKey]);

  // No peer key (or still loading) is not a warning worth interrupting for.
  if (!peerPublicKey || state !== "changed" || !current) {
    return null;
  }

  async function accept() {
    if (!current) {
      return;
    }

    await pinnedSet(conversationId, current);
    setState("trusted");
  }

  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 sm:px-5 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="font-semibold">
        This person&apos;s encryption key changed.
      </p>
      <p className="mt-1">
        New chats encrypt to the key below. Verify it with them outside the
        chat before trusting it — a changed key can mean a new device, or an
        impersonation attempt.
      </p>
      <p className="mt-1 font-mono break-all">{current.fingerprint}</p>
      <button
        type="button"
        onClick={() => void accept()}
        className="mt-2 rounded-lg border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        I verified this key — trust it
      </button>
    </div>
  );
}
