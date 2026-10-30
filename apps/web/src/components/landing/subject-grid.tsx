import {
  Briefcase,
  Calculator,
  Cpu,
  FlaskConical,
  LayoutGrid,
  Palette,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { buildAssignmentsHref } from "@/lib/assignments/urls";

/**
 * Subjects are not a column in the schema, so every card drives the Explore
 * page's existing free-text `search` filter instead. That keeps the grid
 * honest: each link runs a real search and the reader can refine it on
 * the results page.
 */
const SUBJECTS = [
  { label: "Computer Science", icon: Cpu, search: "computer" },
  { label: "Engineering", icon: Wrench, search: "engineering" },
  { label: "Business", icon: Briefcase, search: "business" },
  { label: "Social Sciences", icon: Users, search: "social" },
  { label: "Arts & Humanities", icon: Palette, search: "humanities" },
  { label: "Natural Sciences", icon: FlaskConical, search: "science" },
  { label: "Mathematics", icon: Calculator, search: "math" },
];

export function SubjectGrid() {
  return (
    <section
      aria-labelledby="subjects-heading"
      className="border-border border-t"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-accent text-xs font-semibold tracking-wide uppercase">
            Browse
          </p>
          <h2
            id="subjects-heading"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Explore by subject
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            Each subject opens a search you can narrow by course, semester,
            type, or tag.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SUBJECTS.map((subject) => (
            <li key={subject.label}>
              <Link
                href={buildAssignmentsHref({ search: subject.search })}
                className="border-border bg-surface hover:border-accent focus-visible:outline-accent flex h-full items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <subject.icon
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </span>
                <span className="text-sm font-medium">{subject.label}</span>
              </Link>
            </li>
          ))}

          <li>
            <Link
              href="/assignments"
              className="border-border bg-subtle hover:border-accent focus-visible:outline-accent flex h-full items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <LayoutGrid
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </span>
              <span className="text-sm font-medium">More subjects</span>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
