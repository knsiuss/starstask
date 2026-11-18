"use client";

import { Check, Copy, ShieldCheck, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { computeSafetyNumber } from "@/lib/crypto/e2ee-media";

type Props = {
  open: boolean;
  onClose: () => void;
  peerName: string;
  myPublicKey: string | null;
  peerPublicKey: string | null;
  peerDeviceCount?: number;
};

type ComputedResult =
  | { keyPair: string; status: "ready"; safetyNumber: string }
  | { keyPair: string; status: "error" };

export function SafetyNumberDialog({
  open,
  onClose,
  peerName,
  myPublicKey,
  peerPublicKey,
  peerDeviceCount,
}: Props) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<ComputedResult | null>(null);
  const [copied, setCopied] = useState(false);

  const activePairKey =
    myPublicKey && peerPublicKey ? `${myPublicKey}|${peerPublicKey}` : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !myPublicKey || !peerPublicKey || !activePairKey) {
      return;
    }

    let cancelled = false;

    computeSafetyNumber(myPublicKey, peerPublicKey)
      .then((safetyNumber) => {
        if (!cancelled) {
          setResult({
            keyPair: activePairKey,
            status: "ready",
            safetyNumber,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ keyPair: activePairKey, status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, myPublicKey, peerPublicKey, activePairKey]);

  if (!open) {
    return null;
  }

  const matchedResult =
    activePairKey && result?.keyPair === activePairKey ? result : null;
  const status = !activePairKey
    ? "unavailable"
    : matchedResult
      ? matchedResult.status
      : "loading";
  const safetyNumber =
    matchedResult?.status === "ready" ? matchedResult.safetyNumber : null;
  const groups = safetyNumber ? safetyNumber.split(" ") : [];

  async function handleCopy(): Promise<void> {
    if (!safetyNumber) {
      return;
    }

    try {
      await navigator.clipboard.writeText(safetyNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="border-border bg-surface text-foreground w-full max-w-md rounded-2xl border p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <ShieldCheck
                aria-hidden="true"
                className="h-5 w-5"
              />
            </span>
            <div>
              <h2
                id={titleId}
                className="text-base font-semibold"
              >
                Verify safety number
              </h2>
              <p className="text-muted-foreground text-xs">
                {peerName}
                {typeof peerDeviceCount === "number" && peerDeviceCount > 0
                  ? ` (${peerDeviceCount} active ${peerDeviceCount === 1 ? "device" : "devices"})`
                  : ""}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close safety number dialog"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        </div>

        <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
          Compare these 60 digits with {peerName} in person or on another
          trusted channel. If they match, your conversation is end-to-end
          encrypted with the expected keys.
        </p>

        <div className="border-border bg-muted/40 mt-4 rounded-xl border p-4">
          {status === "loading" ? (
            <p
              className="text-muted-foreground py-4 text-center text-xs"
              role="status"
            >
              Computing safety number...
            </p>
          ) : status === "ready" && safetyNumber ? (
            <div
              className="grid grid-cols-3 gap-x-3 gap-y-2 text-center font-mono text-sm font-medium tracking-wider"
              aria-label={`Safety number: ${safetyNumber}`}
            >
              {groups.map((group, index) => (
                <span
                  key={`${group}-${index}`}
                  className="text-foreground select-all"
                >
                  {group}
                </span>
              ))}
            </div>
          ) : status === "unavailable" ? (
            <p className="text-muted-foreground py-3 text-center text-xs">
              Safety number is unavailable until both participants have active
              encryption keys.
            </p>
          ) : (
            <p
              className="text-danger py-3 text-center text-xs"
              role="alert"
            >
              Could not compute safety number on this device.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {status === "ready" ? (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {copied ? (
                <>
                  <Check
                    aria-hidden="true"
                    className="text-success h-3.5 w-3.5"
                  />
                  Copied
                </>
              ) : (
                <>
                  <Copy
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Copy number
                </>
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
