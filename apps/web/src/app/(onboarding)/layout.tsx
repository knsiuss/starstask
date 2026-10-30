import { Star } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Minimal shell for onboarding.
 *
 * Deliberately not the marketing chrome: the task is one small form, so the
 * page is a brand strip and a centred column, nothing else competing for
 * attention.
 */
export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-border/70 border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-4 sm:px-6">
          <span className="bg-accent text-accent-foreground flex h-8 w-8 items-center justify-center rounded-md">
            <Star
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>
          <span className="font-semibold tracking-tight">StarsTask</span>
        </div>
      </header>

      <main
        id="main-content"
        className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"
      >
        {children}
      </main>
    </div>
  );
}
