import * as React from "react";

import { cn } from "@/lib/utils/cn";

type ProfileSectionProps = {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/**
 * One settings block: a quiet card with a heading and optional header action.
 *
 * Sections are deliberately separate cards instead of a page-long form, so each
 * part of the profile can be read at a glance and edited on its own.
 */
export function ProfileSection({
  id,
  title,
  description,
  action,
  className,
  children,
}: ProfileSectionProps) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      id={id}
      className={cn(
        "border-border bg-surface scroll-mt-24 rounded-xl border",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2
            id={`${id}-heading`}
            className="text-foreground text-sm font-semibold"
          >
            {title}
          </h2>
          {description ? (
            <p className="text-muted-foreground mt-1 max-w-prose text-xs leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

type ProfileRowProps = {
  label: string;
  note?: string;
  muted?: boolean;
  children: React.ReactNode;
};

/** A label/value row. Must be rendered inside a `dl` element. */
export function ProfileRow({
  label,
  note,
  muted = false,
  children,
}: ProfileRowProps) {
  return (
    <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[168px_minmax(0,1fr)] sm:items-baseline sm:gap-5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-sm break-words",
          muted && "text-muted-foreground",
        )}
      >
        {children}
        {note ? (
          <p className="text-muted-foreground mt-1 text-xs">{note}</p>
        ) : null}
      </dd>
    </div>
  );
}
