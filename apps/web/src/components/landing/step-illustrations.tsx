/**
 * Small abstract illustrations for the "How StarsTask works" steps.
 *
 * Like the hero illustration they use bars and blocks instead of text, so no
 * step can look like it is showing a real assignment record.
 */

const frameProps = {
  viewBox: "0 0 200 132",
  "aria-hidden": true,
  className: "h-auto w-full",
} as const;

export function SearchStepIllustration() {
  return (
    <svg {...frameProps}>
      <rect
        width="200"
        height="132"
        rx="12"
        className="fill-accent-soft"
      />
      <rect
        x="24"
        y="20"
        width="152"
        height="26"
        rx="8"
        className="fill-surface stroke-border"
        strokeWidth="1.5"
      />
      <circle
        cx="40"
        cy="33"
        r="5"
        fill="none"
        className="stroke-accent"
        strokeWidth="2"
      />
      <path
        d="M44 37 48 41"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="58"
        y="30"
        width="72"
        height="6"
        rx="3"
        className="fill-border"
      />

      {[0, 1, 2].map((row) => (
        <g key={row}>
          <rect
            x="24"
            y={58 + row * 22}
            width="152"
            height="16"
            rx="6"
            className="fill-surface"
            opacity="0.85"
          />
          <rect
            x="32"
            y={63 + row * 22}
            width="12"
            height="6"
            rx="3"
            className="fill-accent"
            opacity="0.5"
          />
          <rect
            x="52"
            y={63 + row * 22}
            width={row === 1 ? 52 : 74}
            height="6"
            rx="3"
            className="fill-border"
          />
        </g>
      ))}
    </svg>
  );
}

export function ReadStepIllustration() {
  return (
    <svg {...frameProps}>
      <rect
        width="200"
        height="132"
        rx="12"
        className="fill-accent-soft"
      />
      <rect
        x="52"
        y="16"
        width="96"
        height="104"
        rx="8"
        className="fill-surface stroke-border"
        strokeWidth="1.5"
      />
      <rect
        x="64"
        y="28"
        width="48"
        height="7"
        rx="3.5"
        className="fill-accent"
        opacity="0.55"
      />
      {[0, 1, 2, 3].map((line) => (
        <rect
          key={line}
          x="64"
          y={46 + line * 12}
          width={line === 3 ? 44 : 72}
          height="5"
          rx="2.5"
          className="fill-border"
        />
      ))}
      <rect
        x="64"
        y="98"
        width="72"
        height="12"
        rx="6"
        className="fill-accent-soft"
      />
    </svg>
  );
}

export function ContributeStepIllustration() {
  return (
    <svg {...frameProps}>
      <rect
        width="200"
        height="132"
        rx="12"
        className="fill-accent-soft"
      />
      <rect
        x="30"
        y="34"
        width="80"
        height="72"
        rx="8"
        className="fill-surface stroke-border"
        strokeWidth="1.5"
      />
      {[0, 1, 2].map((line) => (
        <rect
          key={line}
          x="42"
          y={48 + line * 14}
          width={line === 2 ? 34 : 56}
          height="5"
          rx="2.5"
          className="fill-border"
        />
      ))}
      <circle
        cx="146"
        cy="70"
        r="30"
        className="fill-surface"
      />
      <circle
        cx="146"
        cy="70"
        r="30"
        fill="none"
        className="stroke-accent"
        strokeWidth="2"
      />
      <path
        d="M146 82V58"
        className="stroke-accent"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M136 68 146 58 156 68"
        fill="none"
        className="stroke-accent"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
