import type { ReactNode } from "react";

import { CONTACT_EMAIL } from "@/lib/config/site";

type LegalPageProps = {
  title: string;
  summary: string;
  updated: string;
  children: ReactNode;
};

export function LegalPage({
  title,
  summary,
  updated,
  children,
}: LegalPageProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="border-border border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {summary}
        </p>
        <p className="text-muted-foreground mt-3 text-xs">
          Last updated: {updated}
        </p>
      </header>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">{children}</div>

      <footer className="border-border mt-10 border-t pt-6">
        <p className="text-muted-foreground text-sm">
          Questions about this document:{" "}
          {CONTACT_EMAIL ? (
            <a
              className="text-accent font-medium underline underline-offset-2"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
          ) : (
            "contact your class admin or the platform administrator."
          )}
        </p>
      </footer>
    </article>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`legal-${slugify(heading)}`}>
      <h2
        id={`legal-${slugify(heading)}`}
        className="text-foreground text-lg font-semibold tracking-tight"
      >
        {heading}
      </h2>
      <div className="text-muted-foreground mt-3 space-y-3">{children}</div>
    </section>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
