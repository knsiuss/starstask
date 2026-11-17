import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/landing/reveal";
import { Button } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <section
      id="about"
      aria-labelledby="closing-heading"
      className="bg-navy text-navy-foreground scroll-mt-16"
    >
      <Reveal className="mx-auto flex max-w-6xl flex-col justify-between gap-8 px-4 py-20 sm:px-6 sm:py-24 lg:flex-row lg:items-center lg:py-28">
        <div className="max-w-xl">
          <p className="text-navy-muted font-mono text-xs font-semibold tracking-wider uppercase">
            Get started
          </p>
          <h2
            id="closing-heading"
            className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-4xl"
          >
            Stop guessing what a brief asks for.
          </h2>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="text-navy-foreground border-navy-border group border hover:bg-white/10"
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
            variant="ghost"
            className="text-navy-muted hover:text-navy-foreground hover:bg-white/10"
          >
            <Link href="/download">Download for Android</Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
