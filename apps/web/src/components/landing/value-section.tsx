import {
  ArrowRight,
  BookOpen,
  Compass,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

const VALUE_CARDS = [
  {
    icon: Compass,
    title: "Assignment discovery",
    description: "Sign in to search and filter real assignment briefs.",
  },
  {
    icon: BookOpen,
    title: "Learning reference",
    description: "Read how a task was framed before you plan your own.",
  },
  {
    icon: Users,
    title: "Student community",
    description: "Contributed by students, credited to their profile.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy by design",
    description: "Assignment content is visible only after signing in.",
  },
];

export function ValueSection() {
  return (
    <section
      aria-labelledby="value-heading"
      className="bg-band"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-20">
        <div className="max-w-lg">
          <p className="text-accent text-xs font-semibold tracking-wide uppercase">
            Why StarsTask
          </p>
          <h2
            id="value-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            A clearer way to navigate university assignments.
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            Every course words its briefs differently, and the useful detail is
            rarely where you expect it. StarsTask keeps the published briefs in
            one searchable place, so you can compare how a task was set and
            spend your time on the work itself.
          </p>

          <div className="mt-7">
            <Link
              href="/assignments"
              className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              Explore assignments
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4"
              />
            </Link>
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {VALUE_CARDS.map((card) => (
            <li
              key={card.title}
              className="border-border bg-surface rounded-xl border p-5 shadow-[0_1px_2px_rgba(9,9,11,0.04)]"
            >
              <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-lg">
                <card.icon
                  aria-hidden="true"
                  className="h-5 w-5"
                />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold tracking-tight">
                {card.title}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {card.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
