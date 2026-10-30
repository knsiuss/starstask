import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type AdminStatCardProps = {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  href: string;
  tone?: "default" | "attention";
};

/**
 * One authoritative counter. The hint states exactly what is counted so an
 * administrator never has to guess what a number includes.
 */
export function AdminStatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: AdminStatCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group border-border bg-surface rounded-xl border p-4 transition-colors sm:p-5",
        "hover:border-accent/50 focus-visible:border-accent",
        tone === "attention" &&
          value > 0 &&
          "border-warning/40 bg-warning-soft",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <Icon
          aria-hidden="true"
          className="text-muted-foreground group-hover:text-accent h-4 w-4 shrink-0"
        />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {hint}
      </p>
    </Link>
  );
}
