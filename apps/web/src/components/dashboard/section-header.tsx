import { ArrowRight } from "lucide-react";
import Link from "next/link";

type SectionHeaderProps = {
  id: string;
  title: string;
  description?: string;
  action?: {
    href: string;
    label: string;
  };
};

export function SectionHeader({
  id,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2
          id={id}
          className="text-foreground text-base font-semibold tracking-tight"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          {action.label}
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      ) : null}
    </div>
  );
}
