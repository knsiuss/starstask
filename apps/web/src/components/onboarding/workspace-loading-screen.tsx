"use client";

import { CheckCircle2, Frown } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { AcademicIllustration } from "./academic-illustration";
import { LoadingStages } from "./loading-stages";
import type { InitStage } from "@/lib/onboarding/init-flow";

type WorkspaceLoadingScreenProps = {
  stage: InitStage;
  completed: boolean;
  error: string | null;
  onRetry: () => void;
  onContinueAnyway: () => void;
  /** Shown under the check mark when initialization finished successfully. */
  successNote?: string | null;
};

/**
 * First-time "Preparing your workspace..." experience.
 *
 * Presentation only: the parent owns the real operations (session probe,
 * workspace sync, server refresh) and passes the stage it is actually on.
 * Nothing here fabricates progress — the bar is indeterminate.
 */
export function WorkspaceLoadingScreen({
  stage,
  completed,
  error,
  onRetry,
  onContinueAnyway,
  successNote,
}: WorkspaceLoadingScreenProps) {
  return (
    <div
      aria-busy={!completed && !error}
      className="st-screen-fade relative flex w-full flex-col items-center overflow-hidden rounded-lg border border-border bg-surface px-6 py-8 shadow-[0_1px_2px_rgba(9,9,11,0.04)] sm:px-8 sm:py-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,var(--color-accent-soft),transparent)] opacity-60"
      />

      <div className="relative flex w-full max-w-md flex-col items-center">
        <div className="st-brand-reveal">
          <BrandMark size={48} />
        </div>
        <p
          className="text-foreground st-fade-up mt-1 text-2xl font-semibold tracking-tight"
          style={{ animationDelay: "200ms" }}
        >
          StarsTask
        </p>
        <p
          className="text-muted-foreground st-fade-up text-xs font-medium tracking-wide"
          style={{ animationDelay: "350ms" }}
        >
          Academic Workspace
        </p>

        <AcademicIllustration className="mt-8" />

        <div
          className="st-fade-up mt-6 w-full text-center"
          style={{ animationDelay: "1500ms" }}
          aria-live="polite"
        >
          {error ? (
            <div
              role="alert"
              className="border-danger/30 bg-danger-soft rounded-2xl border px-5 py-4"
            >
              <p className="text-danger inline-flex items-center gap-1.5 font-semibold">
                <Frown
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Something went wrong
              </p>
              <p className="text-danger mt-1 text-sm">{error}</p>
              <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={onRetry}
                >
                  Retry
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onContinueAnyway}
                >
                  Continue anyway
                </Button>
              </div>
            </div>
          ) : completed ? (
            <div>
              <span className="st-check-pop bg-accent text-accent-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                <CheckCircle2
                  aria-hidden="true"
                  className="h-6 w-6"
                />
              </span>
              <h1 className="text-foreground mt-4 text-xl font-semibold tracking-tight">
                Your workspace is ready.
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Everything is set. Let&apos;s get started.
              </p>
              {successNote ? (
                <p className="text-muted-foreground mt-1 text-sm font-medium">
                  {successNote}
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <h1 className="text-foreground text-xl font-semibold tracking-tight">
                Preparing your workspace...
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Syncing classes, assignments, and schedules.
              </p>
            </div>
          )}
        </div>

        {!error ? (
          <div
            className="st-fade-up mt-6 w-full"
            style={{ animationDelay: "1650ms" }}
          >
            <LoadingStages
              activeStage={stage}
              completed={completed}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
