import {
  ArrowRight,
  GraduationCap,
  Library,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

import { MissionIllustration } from "@/components/landing/mission-illustration";
import { Button } from "@/components/ui/button";

const VALUES = [
  {
    icon: GraduationCap,
    title: "Student first",
    description: "Built around the people writing the assignments.",
  },
  {
    icon: Users,
    title: "Community driven",
    description: "The archive grows one contribution at a time.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy conscious",
    description: "Only briefs cleared for public view are ever listed.",
  },
  {
    icon: Library,
    title: "Growing archive",
    description: "New courses and semesters arrive as students share.",
  },
];

export function MissionSection() {
  return (
    <section
      id="about"
      aria-labelledby="mission-heading"
      className="bg-navy text-navy-foreground scroll-mt-20"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-20">
        <div className="max-w-lg">
          <p className="text-navy-muted text-xs font-semibold tracking-wide uppercase">
            Our mission
          </p>
          <h2
            id="mission-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Built so no student starts a brief without context.
          </h2>
          <p className="text-navy-muted mt-4 text-base leading-relaxed">
            When students share the briefs they receive, everyone can see how a
            task was framed, what was expected, and where the difficulty really
            sat. StarsTask is a learning community first, and an archive second.
          </p>

          <ul className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {VALUES.map((value) => (
              <li
                key={value.title}
                className="flex gap-3"
              >
                <span className="bg-navy-border text-navy-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <value.icon
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </span>
                <div>
                  <p className="text-sm font-semibold">{value.title}</p>
                  <p className="text-navy-muted mt-0.5 text-sm leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-9">
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-navy-foreground border-navy-border border hover:bg-white/10"
            >
              <Link href="/assignments">
                Explore assignments
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-lg lg:max-w-none">
          <MissionIllustration />
        </div>
      </div>
    </section>
  );
}
