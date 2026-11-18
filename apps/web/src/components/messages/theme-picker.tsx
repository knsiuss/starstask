"use client";

const THEMES = [
  "default",
  "sunset",
  "ocean",
  "forest",
  "candy",
  "mono",
] as const;

export function ThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (theme: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={
            value === t
              ? "rounded-full border-2 border-primary px-2 py-1 text-xs"
              : "rounded-full border px-2 py-1 text-xs"
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export const THEME_BUBBLE: Record<string, string> = {
  default: "bg-muted text-foreground",
  sunset: "bg-warning-soft text-warning",
  ocean: "bg-accent text-accent-foreground",
  forest: "bg-success-soft text-success",
  candy: "bg-navy text-navy-foreground",
  mono: "bg-foreground text-background",
};
