/**
 * Stable colour identity for courses on the assignment calendar.
 *
 * The same course keeps the same colour everywhere it appears, so most of the
 * work is a deterministic hash: the palette is ordered from warm to cool and
 * the key picks a slot. Colours are deliberately soft — backgrounds read as
 * tinted surfaces, not saturated fills.
 */
const FALLBACK_SCHEME = {
  key: "sky",
  background: "oklch(0.93 0.045 230)",
  border: "oklch(0.78 0.075 230)",
  text: "oklch(0.36 0.07 240)",
  dot: "oklch(0.62 0.13 240)",
  mutedBackground: "oklch(0.955 0.015 230)",
  mutedText: "oklch(0.48 0.035 240)",
} as const;

export type CourseColorScheme = {
  key: string;
  /** Bar surface: tinted, calm. */
  background: string;
  border: string;
  text: string;
  /** Solid stop used for dots and the deadline flag. */
  dot: string;
  /** Desaturated stop for the "already past" part of a bar. */
  mutedBackground: string;
  mutedText: string;
  /** Done assignments read as green regardless of course colour. */
  doneBackground: string;
  doneBorder: string;
  doneText: string;
};

const PALETTE: readonly Omit<
  CourseColorScheme,
  "doneBackground" | "doneBorder" | "doneText"
>[] = [
  {
    key: "sky",
    background: "oklch(0.93 0.045 230)",
    border: "oklch(0.78 0.075 230)",
    text: "oklch(0.36 0.07 240)",
    dot: "oklch(0.62 0.13 240)",
    mutedBackground: "oklch(0.955 0.015 230)",
    mutedText: "oklch(0.48 0.035 240)",
  },
  {
    key: "emerald",
    background: "oklch(0.93 0.05 160)",
    border: "oklch(0.78 0.07 160)",
    text: "oklch(0.33 0.07 160)",
    dot: "oklch(0.60 0.12 160)",
    mutedBackground: "oklch(0.955 0.018 160)",
    mutedText: "oklch(0.46 0.03 160)",
  },
  {
    key: "amber",
    background: "oklch(0.95 0.07 85)",
    border: "oklch(0.80 0.09 85)",
    text: "oklch(0.36 0.08 75)",
    dot: "oklch(0.70 0.14 75)",
    mutedBackground: "oklch(0.96 0.025 85)",
    mutedText: "oklch(0.48 0.035 75)",
  },
  {
    key: "violet",
    background: "oklch(0.93 0.045 305)",
    border: "oklch(0.78 0.06 305)",
    text: "oklch(0.35 0.07 305)",
    dot: "oklch(0.58 0.12 305)",
    mutedBackground: "oklch(0.955 0.018 305)",
    mutedText: "oklch(0.47 0.03 305)",
  },
  {
    key: "rose",
    background: "oklch(0.94 0.04 20)",
    border: "oklch(0.79 0.06 20)",
    text: "oklch(0.36 0.07 20)",
    dot: "oklch(0.63 0.13 20)",
    mutedBackground: "oklch(0.96 0.018 20)",
    mutedText: "oklch(0.47 0.03 20)",
  },
  {
    key: "cyan",
    background: "oklch(0.93 0.045 210)",
    border: "oklch(0.78 0.065 210)",
    text: "oklch(0.32 0.06 220)",
    dot: "oklch(0.60 0.12 215)",
    mutedBackground: "oklch(0.955 0.018 210)",
    mutedText: "oklch(0.46 0.03 215)",
  },
  {
    key: "orange",
    background: "oklch(0.95 0.06 45)",
    border: "oklch(0.80 0.07 45)",
    text: "oklch(0.37 0.07 45)",
    dot: "oklch(0.68 0.13 45)",
    mutedBackground: "oklch(0.96 0.025 45)",
    mutedText: "oklch(0.49 0.03 45)",
  },
  {
    key: "indigo",
    background: "oklch(0.93 0.045 275)",
    border: "oklch(0.78 0.06 275)",
    text: "oklch(0.34 0.07 275)",
    dot: "oklch(0.56 0.12 275)",
    mutedBackground: "oklch(0.955 0.018 275)",
    mutedText: "oklch(0.47 0.03 275)",
  },
  {
    key: "teal",
    background: "oklch(0.93 0.045 185)",
    border: "oklch(0.77 0.065 185)",
    text: "oklch(0.30 0.055 195)",
    dot: "oklch(0.57 0.1 190)",
    mutedBackground: "oklch(0.955 0.018 185)",
    mutedText: "oklch(0.46 0.03 190)",
  },
  {
    key: "lime",
    background: "oklch(0.95 0.07 125)",
    border: "oklch(0.79 0.08 125)",
    text: "oklch(0.34 0.06 125)",
    dot: "oklch(0.63 0.12 125)",
    mutedBackground: "oklch(0.96 0.03 125)",
    mutedText: "oklch(0.47 0.03 125)",
  },
] as const;

const DONE_SCHEME = {
  doneBackground: "oklch(0.93 0.05 155)",
  doneBorder: "oklch(0.78 0.07 155)",
  doneText: "oklch(0.33 0.06 160)",
} as const;

/** Small deterministic hash, good enough to spread colours across keys. */
function hashKey(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    // A 31x multiplier keeps nearby strings, like "pweb-1" and "pweb-2",
    // in different slots.
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function courseColorFor(courseKey: string): CourseColorScheme {
  const slot = PALETTE[hashKey(courseKey) % PALETTE.length] ?? FALLBACK_SCHEME;

  return { ...slot, ...DONE_SCHEME };
}
