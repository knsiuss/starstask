import type { ReactNode } from "react";

/**
 * Page transition for workspace routes.
 *
 * `template.tsx` remounts on every navigation (unlike `layout.tsx`), so the
 * fade/rise animation replays on each page change instead of the screen
 * sitting blank-white while the server responds. The animation class already
 * respects `prefers-reduced-motion` in `globals.css`.
 */
export default function WorkspaceTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="st-screen-fade">{children}</div>;
}
