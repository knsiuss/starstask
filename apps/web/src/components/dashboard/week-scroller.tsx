"use client";

import { useEffect, useRef, type ReactNode } from "react";

type WeekScrollerProps = {
  children: ReactNode;
};

/**
 * Fixed-width week strip that scrolls sideways instead of squeezing its days.
 *
 * The strip opens scrolled to today so the current day is visible on narrow
 * screens; the scroll runs once on mount and never fights a manual scroll.
 */
export function WeekScroller({ children }: WeekScrollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const today = container?.querySelector<HTMLElement>('[data-today="true"]');

    if (!container || !today) {
      return;
    }

    container.scrollLeft = today.offsetLeft - container.clientLeft;
  }, []);

  return (
    <div
      ref={containerRef}
      data-week-scroller="true"
      className="relative mt-3 snap-x snap-proximity overflow-x-auto pb-1"
    >
      {children}
    </div>
  );
}
