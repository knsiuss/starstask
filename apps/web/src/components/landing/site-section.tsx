import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type SiteSectionProps = {
  id?: string;
  labelledby?: string;
  eyebrow: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  band?: "band" | "navy";
  width?: "wide" | "narrow";
  className?: string;
  titleClassName?: string;
};

/**
 * One section rhythm for the public landing page: eyebrow, H2, lead line,
 * then content, all inside the same max-w container and py steps.
 * `band` paints the pale-blue value band; `navy` is the mission panel.
 */
export function SiteSection({
  id,
  labelledby,
  eyebrow,
  title,
  description,
  children,
  band,
  width = "wide",
  className,
  titleClassName,
}: SiteSectionProps) {
  const isNavy = band === "navy";

  return (
    <section
      id={id}
      aria-labelledby={labelledby}
      className={cn(
        isNavy
          ? "bg-navy text-navy-foreground scroll-mt-20"
          : band === "band"
            ? "bg-band"
            : "scroll-mt-20",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto px-4 py-14 sm:px-6 sm:py-16 lg:py-20",
          width === "wide" ? "max-w-6xl" : "max-w-3xl",
        )}
      >
        <header className="max-w-2xl">
          <p
            className={cn(
              "text-xs font-semibold tracking-wide uppercase",
              isNavy ? "text-navy-muted" : "text-accent",
            )}
          >
            {eyebrow}
          </p>
          <h2
            id={labelledby}
            className={cn(
              "mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl",
              titleClassName,
            )}
          >
            {title}
          </h2>
          {description ? (
            <p
              className={cn(
                "mt-4 text-base leading-relaxed",
                isNavy ? "text-navy-muted" : "text-muted-foreground",
              )}
            >
              {description}
            </p>
          ) : null}
        </header>

        {children}
      </div>
    </section>
  );
}
