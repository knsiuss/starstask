import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/landing/reveal";
import { buildAssignmentsHref } from "@/lib/assignments/urls";

const PILLARS = [
  {
    index: "01",
    title: "Structured briefs",
    description:
      "Prompt, deadline, and attachments stored together in one record.",
  },
  {
    index: "02",
    title: "Reviewed by classes",
    description:
      "Class admins clear submissions before they appear in public search.",
  },
  {
    index: "03",
    title: "Author ownership",
    description:
      "Sign in with Google to edit or remove your own contributions anytime.",
  },
] as const;

const SUBJECTS = [
  { label: "Computer Science", search: "computer" },
  { label: "Engineering", search: "engineering" },
  { label: "Business", search: "business" },
  { label: "Social Sciences", search: "social" },
  { label: "Arts & Humanities", search: "humanities" },
  { label: "Natural Sciences", search: "science" },
  { label: "Mathematics", search: "math" },
] as const;

export function ArchivePillars() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="pillars-heading"
      className="border-border scroll-mt-16 border-b"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <p className="text-accent font-mono text-xs font-semibold tracking-wider uppercase">
            How it works
          </p>
          <h2
            id="pillars-heading"
            className="text-foreground mt-2 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl lg:text-4xl"
          >
            Built like a catalogue, not a feed.
          </h2>
        </Reveal>

        <ol className="border-border divide-border mt-10 grid divide-y border-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {PILLARS.map((pillar, index) => (
            <li
              key={pillar.index}
              className="py-6 lg:px-6 lg:py-8 lg:first:pl-0 lg:last:pr-0"
            >
              <Reveal delay={index * 90}>
                <span className="text-accent font-mono text-xs font-semibold">
                  {pillar.index}
                </span>
                <h3 className="text-foreground mt-3 text-base font-semibold tracking-tight">
                  {pillar.title}
                </h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {pillar.description}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal
          delay={120}
          className="mt-8"
        >
          <p className="text-muted-foreground mb-3 font-mono text-xs uppercase">
            Subjects
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {SUBJECTS.map((subject) => (
              <Link
                key={subject.label}
                href={buildAssignmentsHref({ search: subject.search })}
                className="border-border bg-subtle text-foreground hover:border-accent hover:text-accent focus-visible:outline-accent inline-flex min-h-10 items-center rounded-md border px-3 py-2 text-xs font-medium transition-all duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-8 sm:py-1.5"
              >
                {subject.label}
              </Link>
            ))}
            <Link
              href="/assignments"
              className="text-accent group inline-flex min-h-10 items-center gap-1 px-2 py-2 text-xs font-medium hover:underline sm:min-h-8 sm:py-1.5"
            >
              All subjects
              <ArrowUpRight
                aria-hidden="true"
                className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
