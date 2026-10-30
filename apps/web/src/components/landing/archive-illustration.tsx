/**
 * Illustration for the hero: a laptop showing the shape of the assignment
 * archive.
 *
 * Everything on the screen is drawn with abstract bars and blocks rather than
 * text, so the illustration can never be mistaken for a real published
 * assignment or read as if it contained student data.
 */
export function ArchiveIllustration() {
  return (
    <svg
      viewBox="0 0 560 400"
      role="img"
      aria-label="Illustration of a laptop showing an archive of assignment briefs"
      className="h-auto w-full"
    >
      {/* Soft blue-tinted ground behind the device. */}
      <rect
        x="24"
        y="28"
        width="512"
        height="316"
        rx="40"
        className="fill-accent-soft"
      />
      <circle
        cx="500"
        cy="72"
        r="26"
        className="fill-surface"
        opacity="0.7"
      />
      <circle
        cx="72"
        cy="300"
        r="18"
        className="fill-surface"
        opacity="0.7"
      />

      {/* Screen bezel. */}
      <rect
        x="64"
        y="44"
        width="432"
        height="272"
        rx="16"
        className="fill-surface stroke-border"
        strokeWidth="2"
      />

      {/* Display. */}
      <rect
        x="78"
        y="58"
        width="404"
        height="244"
        rx="10"
        className="fill-subtle"
      />

      {/* Window chrome. */}
      <circle
        cx="96"
        cy="76"
        r="4"
        className="fill-border"
      />
      <circle
        cx="110"
        cy="76"
        r="4"
        className="fill-border"
      />
      <circle
        cx="124"
        cy="76"
        r="4"
        className="fill-border"
      />

      {/* Search field with a magnifier glyph. */}
      <rect
        x="94"
        y="92"
        width="372"
        height="32"
        rx="9"
        className="fill-surface stroke-border"
        strokeWidth="1.5"
      />
      <circle
        cx="112"
        cy="108"
        r="5.5"
        fill="none"
        className="stroke-muted-foreground"
        strokeWidth="2"
      />
      <path
        d="M116.5 112.5 121 117"
        className="stroke-muted-foreground"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="132"
        y="105"
        width="152"
        height="7"
        rx="3.5"
        className="fill-border"
      />

      {/* Three archive rows: icon, title bar, meta bar, and a type pill. */}
      {[0, 1, 2].map((row) => {
        const top = 138 + row * 54;

        return (
          <g key={row}>
            <rect
              x="94"
              y={top}
              width="372"
              height="46"
              rx="9"
              className="fill-surface stroke-border"
              strokeWidth="1.5"
            />
            <rect
              x="106"
              y={top + 11}
              width="24"
              height="24"
              rx="7"
              className="fill-accent-soft"
            />
            <rect
              x="142"
              y={top + 13}
              width={row === 1 ? 118 : 146}
              height="8"
              rx="4"
              className="fill-muted-foreground"
              opacity="0.55"
            />
            <rect
              x="142"
              y={top + 27}
              width={row === 2 ? 74 : 96}
              height="6"
              rx="3"
              className="fill-border"
            />
            <rect
              x="384"
              y={top + 14}
              width="66"
              height="18"
              rx="9"
              className="fill-accent-soft"
            />
          </g>
        );
      })}

      {/* Laptop base and hinge. */}
      <rect
        x="40"
        y="316"
        width="480"
        height="16"
        rx="8"
        className="fill-border"
      />
      <rect
        x="248"
        y="316"
        width="64"
        height="5"
        rx="2.5"
        className="fill-input"
      />
      <rect
        x="64"
        y="336"
        width="432"
        height="6"
        rx="3"
        className="fill-muted"
      />
    </svg>
  );
}
