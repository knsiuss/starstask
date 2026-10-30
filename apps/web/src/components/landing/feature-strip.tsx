import { ListChecks, Search, Share2, Users } from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Search real examples",
    description: "Filter the archive by course, semester, type, or tag.",
  },
  {
    icon: ListChecks,
    title: "Understand requirements",
    description: "Read the full brief, deadline, and references up front.",
  },
  {
    icon: Users,
    title: "Learn from peers",
    description: "See how students in other courses framed the same task.",
  },
  {
    icon: Share2,
    title: "Give something back",
    description:
      "Publish the briefs you receive so the next student starts ahead.",
  },
];

export function FeatureStrip() {
  return (
    <section
      aria-label="Why students use StarsTask"
      className="border-border border-b"
    >
      <ul className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:gap-8 lg:py-12">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            className="flex gap-3"
          >
            <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <feature.icon
                aria-hidden="true"
                className="h-5 w-5"
              />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                {feature.title}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
