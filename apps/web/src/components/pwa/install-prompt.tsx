"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "starstask:install-prompt-dismissed";
const SHOW_AFTER_MS = 1200;

/**
 * Install prompt for the PWA, as a banner anchored to the bottom.
 * Android/Chrome fires `beforeinstallprompt`; iOS Safari has no such
 * event, so it gets a hint pointing at Share -> Add to Home Screen.
 * Never shows when already installed (standalone) or after dismiss.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY)) {
      return;
    }

    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    const timer = window.setTimeout(() => {
      const onPrompt = (event: Event) => {
        event.preventDefault();
        setDeferred(event as BeforeInstallPromptEvent);
      };

      window.addEventListener("beforeinstallprompt", onPrompt);

      const userAgent = window.navigator.userAgent;
      // iPadOS 13+ reports as Macintosh; matchTouch on a Mac UA covers it.
      const isIos =
        /iphone|ipad|ipod/i.test(userAgent) ||
        (userAgent.includes("Macintosh") && "ontouchend" in document);
      if (isIos) {
        setIosHint(true);
      }

      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }, SHOW_AFTER_MS);

    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setDeferred(null);
    setIosHint(false);
  }

  async function install() {
    if (!deferred) {
      return;
    }

    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (dismissed || (!deferred && !iosHint)) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Install StarsTask"
      className="border-border bg-surface fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border p-4 shadow-xl"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Install StarsTask</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {iosHint
            ? "Tap Share, then Add to Home Screen."
            : "Add it to your home screen as an app."}
        </p>
      </div>
      {deferred ? (
        <button
          type="button"
          onClick={install}
          className="bg-accent hover:bg-accent-hover inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white"
        >
          <Download
            aria-hidden="true"
            className="h-4 w-4"
          />
          Install
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground shrink-0 rounded-full p-1"
      >
        <X
          aria-hidden="true"
          className="h-4 w-4"
        />
      </button>
    </div>
  );
}
