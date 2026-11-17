import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { HeroArchivePreview } from "@/components/landing/hero-archive-preview";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="border-border bg-subtle border-b">
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:pt-28 lg:pb-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="st-fade-up text-accent font-mono text-xs font-semibold tracking-wider uppercase">
            StarsTask Archive
          </p>

          <h1
            style={{ animationDelay: "70ms" }}
            className="st-fade-up text-foreground mt-3 text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance sm:mt-4 sm:text-5xl lg:text-[3.75rem] lg:leading-[1.04]"
          >
            Assignment briefs, organized for students.
          </h1>

          <p
            style={{ animationDelay: "140ms" }}
            className="st-fade-up text-muted-foreground mx-auto mt-4 max-w-lg text-sm leading-relaxed sm:mt-5 sm:text-lg"
          >
            Search real course prompts, deadlines, and starter files before you
            begin.
          </p>

          <div
            style={{ animationDelay: "210ms" }}
            className="st-fade-up mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-9 sm:flex-row sm:items-center"
          >
            <Button
              asChild
              size="lg"
              className="group"
            >
              <Link href="/assignments">
                Explore assignments
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
            >
              <Link href="/classes/discover">Browse classes</Link>
            </Button>
          </div>
        </div>

        <div
          style={{ animationDelay: "280ms" }}
          className="st-fade-up mx-auto mt-12 max-w-4xl sm:mt-16"
        >
          <HeroArchivePreview />
        </div>
      </div>
    </section>
  );
}
