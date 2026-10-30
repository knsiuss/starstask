import { BookOpen, CheckCircle2, Sparkles } from "lucide-react";

import { ArchiveIllustration } from "@/components/landing/archive-illustration";

/**
 * The three notes that float beside the illustration on wide screens. Each one
 * is repeated by the feature strip below, which is what narrow screens show.
 */
const HERO_NOTES = [
  {
    icon: BookOpen,
    title: "Real briefs",
    description: "Published by students",
    position: "top-6 -left-10",
  },
  {
    icon: CheckCircle2,
    title: "Understand requirements",
    description: "Read before you start",
    position: "top-1/2 -right-8",
  },
  {
    icon: Sparkles,
    title: "Learn from past work",
    description: "See how it was framed",
    position: "bottom-10 -left-6",
  },
];

export function LandingHero() {
  return (
    <section className="border-border bg-subtle border-b">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10 lg:py-20">
        <div className="max-w-xl">
          <p className="border-border bg-background text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <Sparkles
              aria-hidden="true"
              className="text-accent h-3.5 w-3.5"
            />
            Built for university students
          </p>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Find. Understand. Contribute.
          </h1>

          <p className="text-muted-foreground mt-5 text-base leading-relaxed sm:text-lg">
            StarsTask collects assignment briefs from courses across
            universities, so you can see what a task really asks for before you
            start. Sign in with Google to browse briefs and contribute your own.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <ArchiveIllustration />

          {HERO_NOTES.map((note) => (
            <div
              key={note.title}
              className={`border-border bg-surface absolute hidden items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-[0_6px_20px_rgba(9,9,11,0.08)] lg:flex ${note.position}`}
            >
              <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <note.icon
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </span>
              <span>
                <span className="text-foreground block text-xs font-semibold">
                  {note.title}
                </span>
                <span className="text-muted-foreground block text-[11px]">
                  {note.description}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
