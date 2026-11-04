"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { WorkspaceLoadingScreen } from "@/components/onboarding/workspace-loading-screen";
import type { InitStage } from "@/lib/onboarding/init-flow";

type OnboardingWelcomeProps = {
  /** `onboarded_at` from the save response; null means the save raced. */
  onboardedAt: string | null;
  successNote?: string | null;
  onReady: () => void;
  onSessionExpired: () => void;
};

const STAGE_READY: InitStage = "almostReady";

/**
 * Welcome & Initialization.
 *
 * Runs real operations in order and only advances the stage when each
 * resolves:
 * - Initialize: the save response proves the profile completed.
 * - Sync Data: an authenticated read proves the session and workspace load.
 * - Almost Ready: a server refresh re-verifies the onboarding gate.
 */
export function OnboardingWelcome({
  onboardedAt,
  successNote,
  onReady,
  onSessionExpired,
}: OnboardingWelcomeProps) {
  const router = useRouter();
  const [stage, setStage] = React.useState<InitStage>("initialize");
  const [completed, setCompleted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const startedRef = React.useRef(false);

  const runInitialization = React.useCallback(async () => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    setError(null);
    setCompleted(false);
    setStage("initialize");

    try {
      if (!onboardedAt) {
        throw new Error("Your profile was not completed. Please try again.");
      }

      setStage("sync");

      const response = await fetch("/api/my-assignments");

      if (response.status === 401) {
        onSessionExpired();

        return;
      }

      if (!response.ok) {
        throw new Error(
          "We couldn't sync your workspace data. Check your connection and try again.",
        );
      }

      setStage(STAGE_READY);
      router.refresh();
      setCompleted(true);
    } catch (caught) {
      startedRef.current = false;
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't finish preparing your workspace. Please try again.",
      );
    }
  }, [onboardedAt, onSessionExpired, router]);

  const retry = React.useCallback(() => {
    startedRef.current = false;
    void runInitialization();
  }, [runInitialization]);

  React.useEffect(() => {
    void runInitialization();
  }, [runInitialization]);

  React.useEffect(() => {
    if (!completed) {
      return;
    }

    // Presentation dwell for the check-pop. This never feeds the stage state.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(onReady, reduced ? 250 : 1400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [completed, onReady]);

  const continueAnyway = React.useCallback(() => {
    router.refresh();
    onReady();
  }, [onReady, router]);

  return (
    <WorkspaceLoadingScreen
      stage={stage}
      completed={completed}
      error={error}
      onRetry={retry}
      onContinueAnyway={continueAnyway}
      successNote={successNote}
    />
  );
}
