"use client";

import { CirclePlus } from "lucide-react";

import { JoinClassForm } from "@/components/classes/join-class-form";
import { Button } from "@/components/ui/button";

type JoinClassStepProps = {
  onSkip: () => void;
};

/**
 * Dedicated "Join your class" step.
 *
 * Reuses the existing name-or-code join (POST /api/classes/join) and its
 * result panels, so membership rules and duplicate handling stay in one
 * place. Skipping is a first-class path: onboarding still completes and the
 * student can join later from My Classes.
 */
export function JoinClassStep({ onSkip }: JoinClassStepProps) {
  return (
    <div className="border-border bg-surface st-screen-fade w-full max-w-xl rounded-lg border p-6 shadow-[0_1px_2px_rgba(9,9,11,0.04)] sm:p-8">
      <span className="bg-accent-soft text-accent mx-auto flex h-12 w-12 items-center justify-center rounded-full">
        <CirclePlus
          aria-hidden="true"
          className="h-6 w-6"
        />
      </span>
      <h1 className="text-foreground mt-4 text-center text-xl font-semibold tracking-tight">
        Join your class
      </h1>
      <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
        Enter the class name or code provided by your class administrator to get
        started.
      </p>

      <JoinClassForm
        submittedLink=""
        showInvalidLink={false}
      />

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
          You can also join a class later from My Classes.
        </p>
      </div>
    </div>
  );
}
