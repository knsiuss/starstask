import type { LucideIcon } from "lucide-react";

export function DeveloperMetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <div className="border-border bg-surface rounded-xl border p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <Icon
          aria-hidden="true"
          className="text-muted-foreground h-4 w-4 shrink-0"
        />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {hint}
      </p>
    </div>
  );
}
