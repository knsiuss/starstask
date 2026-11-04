"use client";

import { cn } from "@/lib/utils/cn";
import { INIT_STAGES, type InitStage } from "@/lib/onboarding/init-flow";

type LoadingStagesProps = {
  activeStage: InitStage;
  completed: boolean;
};

/**
 * Initialize → Sync Data → Almost Ready.
 *
 * Purely presentational: the parent advances the stage only when a real
 * operation resolves, so no stage here is a guess.
 */
export function LoadingStages({ activeStage, completed }: LoadingStagesProps) {
  const activeIndex = INIT_STAGES.findIndex(
    (stage) => stage.id === activeStage,
  );

  return (
    <div>
      <div
        role="progressbar"
        aria-busy={!completed}
        aria-label="Workspace initialization progress (indeterminate)"
        className="st-progress-track bg-accent-soft relative h-2 w-full overflow-hidden rounded-full"
      >
        {completed ? (
          <div className="bg-accent h-full w-full rounded-full" />
        ) : (
          <div className="st-progress-bar bg-accent absolute inset-y-0 w-2/5 rounded-full" />
        )}
      </div>

      <ol
        aria-label="Initialization stages"
        className="mt-5 flex items-start justify-between"
      >
        {INIT_STAGES.map((stage, index) => {
          const isDone = completed || index < activeIndex;
          const isActive = !completed && index === activeIndex;

          return (
            <li
              key={stage.id}
              className="flex flex-1 flex-col items-center gap-2 text-center"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                  isDone && "st-check-pop bg-accent text-accent-foreground",
                  isActive && "border-accent border-2",
                  !isDone && !isActive && "border-border border-2",
                )}
              >
                {isDone ? (
                  "✓"
                ) : isActive ? (
                  <span
                    className={cn(
                      "border-accent block h-4 w-4 animate-spin rounded-full",
                      "border-2 border-t-transparent",
                    )}
                  />
                ) : (
                  <span className="bg-input block h-2 w-2 rounded-full" />
                )}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive || isDone
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
