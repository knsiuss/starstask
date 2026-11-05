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
  default: "bg-muted",
  sunset: "bg-gradient-to-r from-orange-400 to-pink-500 text-white",
  ocean: "bg-gradient-to-r from-blue-400 to-cyan-400 text-white",
  forest: "bg-gradient-to-r from-green-500 to-emerald-600 text-white",
  candy: "bg-gradient-to-r from-pink-400 to-purple-500 text-white",
  mono: "bg-black text-white",
};
