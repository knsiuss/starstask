"use client";

import { CirclePlus } from "lucide-react";
import * as React from "react";

import { CreateClassForm } from "@/components/classes/create-class-form";
import { JoinClassForm } from "@/components/classes/join-class-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type JoinClassStepProps = {
  onSkip: () => void;
};

type Mode = "join" | "create";

const TABS: Array<{ mode: Mode; label: string }> = [
  { mode: "join", label: "Join a class" },
  { mode: "create", label: "Create your own" },
];

/**
 * The "Join your class" onboarding step.
 *
 * Two paths in, one place: join by name/code (existing `/api/classes/join`)
 * or open a self-organized class (`/api/classes/create-student`), which also
 * makes the creator the ketua kelas automatically. Skipping is a first-class
 * path: onboarding still completes and joining can happen later from My
 * Classes.
 */
export function JoinClassStep({ onSkip }: JoinClassStepProps) {
  const [mode, setMode] = React.useState<Mode>("join");

  return (
    <div className="border-border bg-surface st-screen-fade w-full max-w-xl rounded-lg border p-6 shadow-[0_1px_2px_rgba(9,9,11,0.04)] sm:p-8">
      <span className="bg-accent-soft text-accent mx-auto flex h-12 w-12 items-center justify-center rounded-full">
        <CirclePlus
          aria-hidden="true"
          className="h-6 w-6"
        />
      </span>
      <h1 className="text-foreground mt-4 text-center text-xl font-semibold tracking-tight">
        Your class
      </h1>
      <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
        Join the class your lecturer set up, or open your own study group and
        share the invitation with your classmates.
      </p>

      <div
        role="tablist"
        aria-label="How to start"
        className="border-border bg-subtle mt-6 flex gap-1 rounded-lg border p-1"
      >
        {TABS.map((tab) => {
          const isActive = mode === tab.mode;

          return (
            <button
              key={tab.mode}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setMode(tab.mode)}
              className={cn(
                "focus-visible:outline-accent flex-1 rounded-md px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2",
                isActive
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {mode === "join" ? (
          <JoinClassForm
            submittedLink=""
            showInvalidLink={false}
          />
        ) : (
          <CreateClassForm />
        )}
      </div>

      <div className="mt-6">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <p className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
          You can also join or create a class later from My Classes.
        </p>
      </div>
    </div>
  );
}
