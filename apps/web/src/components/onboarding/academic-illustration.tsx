import { cn } from "@/lib/utils/cn";
import { GraduationCap } from "lucide-react";

type AcademicIllustrationProps = {
  className?: string;
};

/**
 * Checklist, calendar, and graduation-cap cards around a revealed orbit.
 *
 * Purely presentational: entrances, floating, glow, and twinkle are CSS and
 * collapse under the global reduced-motion rule.
 */
export function AcademicIllustration({ className }: AcademicIllustrationProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("relative mx-auto h-56 w-full max-w-sm sm:h-64", className)}
    >
      <div className="st-glow absolute top-1/2 left-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent)]" />
      <svg
        viewBox="0 0 320 180"
        className="absolute inset-0 h-full w-full"
      >
        <ellipse
          cx="160"
          cy="95"
          rx="150"
          ry="68"
          fill="none"
          className="st-orbit stroke-accent"
          strokeWidth="1.6"
          opacity="0.45"
        />
      </svg>
      <span className="st-twinkle absolute top-6 left-8 text-lg text-accent">
        ✦
      </span>
      <span
        className="st-twinkle absolute top-10 right-10 text-sm text-accent/60"
        style={{ animationDelay: "1s" }}
      >
        ✦
      </span>
      <span
        className="st-twinkle absolute bottom-8 left-14 text-xs text-accent/60"
        style={{ animationDelay: "2s" }}
      >
        ✦
      </span>

      <div className="absolute top-6 left-1/2 w-44 -translate-x-1/2">
        <div
          className="st-enter-up rounded-2xl border border-border bg-surface p-4 shadow-xl"
          style={{ animationDelay: "800ms" }}
        >
          <div className="st-float">
            <div className="flex items-center gap-2">
              <span className="bg-accent flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-accent-foreground">
                ✓
              </span>
              <div className="h-2 w-20 rounded bg-accent-soft" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-accent border-accent flex h-5 w-5 items-center justify-center rounded border-2 text-[10px] font-bold text-accent-foreground">
                  ✓
                </span>
                <div className="h-1.5 w-24 rounded bg-foreground/30" />
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-accent border-accent flex h-5 w-5 items-center justify-center rounded border-2 text-[10px] font-bold text-accent-foreground">
                  ✓
                </span>
                <div className="h-1.5 w-16 rounded bg-foreground/30" />
              </div>
              <div className="flex items-center gap-2">
                <span className="border-input flex h-5 w-5 items-center justify-center rounded border-2" />
                <div className="h-1.5 w-20 rounded bg-foreground/20" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="st-enter-left st-float-slow absolute top-24 left-0 w-20 rounded-xl border border-border bg-surface p-3 shadow-lg sm:left-2"
        style={{ animationDelay: "900ms" }}
      >
        <p className="text-accent text-center text-2xl font-bold leading-none">
          15
        </p>
        <p className="text-muted-foreground mt-1 text-center text-[10px] font-semibold tracking-wide uppercase">
          Nov
        </p>
      </div>

      <div
        className="st-enter-right st-float-slow absolute top-24 right-0 w-20 rounded-xl border border-border bg-surface p-3 shadow-lg sm:right-2"
        style={{ animationDelay: "1000ms" }}
      >
        <GraduationCap
          aria-hidden="true"
          className="text-accent mx-auto h-7 w-7"
        />
        <p className="text-muted-foreground mt-1 text-center text-[10px] font-semibold">
          Classes
        </p>
      </div>
    </div>
  );
}
