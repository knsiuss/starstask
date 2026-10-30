import { MoveRight } from "lucide-react";

import {
  ContributeStepIllustration,
  ReadStepIllustration,
  SearchStepIllustration,
} from "@/components/landing/step-illustrations";

const STEPS = [
  {
    illustration: SearchStepIllustration,
    title: "Search the archive",
    description:
      "Filter by course, semester, type, or tag. Every public page works without an account.",
  },
  {
    illustration: ReadStepIllustration,
    title: "Read the real brief",
    description:
      "See the description, deadline, references, and downloadable attachments before you commit to the work.",
  },
  {
    illustration: ContributeStepIllustration,
    title: "Give something back",
    description:
      "Sign in with Google to publish the briefs you receive. You can edit or delete only your own contributions.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="scroll-mt-20"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-accent text-xs font-semibold tracking-wide uppercase">
            Three steps
          </p>
          <h2
            id="how-heading"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            How StarsTask works
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            From a first search to a contribution you are happy to put your name
            on.
          </p>
        </div>

        <ol className="mt-12 grid gap-8 lg:grid-cols-3 lg:gap-12">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative"
            >
              <div className="border-border bg-surface rounded-xl border p-5 shadow-[0_1px_2px_rgba(9,9,11,0.04)]">
                <div className="relative">
                  <step.illustration />
                  <span
                    aria-hidden="true"
                    className="bg-surface text-accent border-border absolute -top-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold shadow-[0_1px_2px_rgba(9,9,11,0.06)]"
                  >
                    {index + 1}
                  </span>
                </div>

                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>

              {index < STEPS.length - 1 ? (
                <MoveRight
                  aria-hidden="true"
                  className="text-border absolute top-1/2 -right-9 hidden h-6 w-6 -translate-y-1/2 lg:block"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
