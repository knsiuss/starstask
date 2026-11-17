# DESIGN.md — StarsTask

Reading this as: academic product landing for university students, in a warm-neutral + slate-accent language, dial ENERGY 2 / RHYTHM 2 / MOTION 2.

Recorded from the shipped tokens (`apps/web/src/app/globals.css`): `--color-background #fafaf8`, `--color-surface #ffffff`, `--color-foreground #292d34`, `--color-muted-foreground #646b76`, `--color-accent #45639e`, `--color-accent-hover #3a5588`, `--color-accent-soft #e8edfa`, `--color-band #eef3fc`, `--color-navy #16203a`. The palette is a single deliberate accent (slate blue) over a warm-neutral base. Reason: a university archive should feel like a library catalogue, not a tech product, so the neutral stays paper-warm and the accent reads as ink rather than neon.

Typography: Inter (existing `--font-inter`) everywhere. Reason: readability at small sizes for time-pressed students; no display face is introduced, hierarchy comes from weight and size, not from a second typeface.

Identity motif: the abstract-bar illustration language (grey bars and blocks, never fake assignment text). Reason: it is the one product-specific gesture, it appears in the hero and in every how-it-works step, and it guarantees the page can never be mistaken for a real record.

Dials: ENERGY 2 / RHYTHM 2 / MOTION 2.

- ENERGY 2: the hero speaks, everything below stays calm. One accent moment per viewport (the primary CTA), not a wash across every tile.
- RHYTHM 2: sections move between two-column splits and full-width lists, not one centered template repeated.
- MOTION 2: one scroll-reveal treatment (fade-up, 420ms ease-out, once), plus existing hover states. No endless float, twinkle, or glow loops on the landing. This honors the "lebih bersih dan ber animasi" request without turning motion into wallpaper.

Accent decisions, written down:

- Gradient: none on the landing. A single `accent-soft` panel behind the hero illustration separates device from page by hierarchy (R-01).
- Shadows: only the floating hero notes carry a shadow, because they are the only elements that lift off the ground plane; all cards sit flat with border only (R-12).
- Radius: buttons use `rounded-md`, cards and pills use `rounded-xl` / `rounded-lg` tile rounding. One radius family, applied deliberately, not pill-everything (R-11).
- Icons: Lucide throughout, chosen for content relevance (search, book, users, share, calendar), not for the library look. Sparkle/magic glyphs are removed from the hero. Reason per icon is its subject, not the set (R-04).
- Dark mode: both themes are first-class (`.dark` token remap). Reason: the workspace is a reading tool used at night in dorms, so a working light/dark toggle is a product feature, not a default (R-21).
