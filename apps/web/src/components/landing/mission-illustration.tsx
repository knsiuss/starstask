/**
 * Abstract product UI for the mission section: an archive panel with a small
 * group of contributors above it. Everything is a bar, block, or glyph, so the
 * graphic never depicts a real record or a real person.
 */
export function MissionIllustration() {
  return (
    <svg
      viewBox="0 0 320 248"
      role="img"
      aria-label="Illustration of an archive panel shared by a group of contributors"
      className="h-auto w-full"
    >
      {/* Soft blue glow behind the panel. */}
      <circle
        cx="160"
        cy="150"
        r="96"
        className="fill-accent"
        opacity="0.16"
      />

      {/* Contributor avatars, drawn as abstract glyphs. */}
      {[
        { cx: 218, cy: 34 },
        { cx: 256, cy: 40 },
        { cx: 292, cy: 60 },
      ].map((avatar) => (
        <g key={avatar.cx}>
          <circle
            cx={avatar.cx}
            cy={avatar.cy}
            r="18"
            className="fill-accent stroke-navy"
            strokeWidth="3"
          />
          <circle
            cx={avatar.cx}
            cy={avatar.cy - 5}
            r="4.5"
            className="fill-accent-soft"
          />
          <path
            d={`M${avatar.cx - 8} ${avatar.cy + 10} a8 8 0 0 1 16 0`}
            className="fill-accent-soft"
          />
        </g>
      ))}

      {/* Archive panel. */}
      <rect
        x="20"
        y="58"
        width="280"
        height="168"
        rx="16"
        className="fill-navy-border"
      />

      {/* Panel header. */}
      <circle
        cx="50"
        cy="90"
        r="12"
        className="fill-accent"
      />
      <rect
        x="70"
        y="82"
        width="80"
        height="7"
        rx="3.5"
        className="fill-navy-foreground"
        opacity="0.4"
      />
      <rect
        x="70"
        y="95"
        width="52"
        height="6"
        rx="3"
        className="fill-navy-foreground"
        opacity="0.22"
      />
      <path
        d="M36 116H284"
        className="stroke-navy-foreground"
        strokeWidth="1"
        opacity="0.14"
      />

      {/* Archive rows. */}
      {[0, 1, 2].map((row) => {
        const top = 128 + row * 34;

        return (
          <g key={row}>
            <rect
              x="36"
              y={top}
              width="248"
              height="26"
              rx="8"
              className="fill-navy-foreground"
              opacity="0.08"
            />
            <rect
              x="48"
              y={top + 10}
              width={row === 1 ? 78 : 104}
              height="6"
              rx="3"
              className="fill-navy-foreground"
              opacity="0.28"
            />
            <rect
              x="228"
              y={top + 7}
              width="44"
              height="12"
              rx="6"
              className="fill-accent"
              opacity="0.6"
            />
          </g>
        );
      })}
    </svg>
  );
}
