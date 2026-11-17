"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

type WeekScrollerProps = {
  children: ReactNode;
};

const KEYBOARD_SCROLL_STEP_PX = 160;

/**
 * Week strip that scrolls sideways instead of squeezing its days.
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      container.scrollBy({ left: -KEYBOARD_SCROLL_STEP_PX, behavior: "auto" });
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      container.scrollBy({ left: KEYBOARD_SCROLL_STEP_PX, behavior: "auto" });
    }
  };

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Weekly timeline"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-week-scroller="true"
      className="no-scrollbar focus-visible:outline-accent relative mt-3 snap-x snap-proximity overflow-x-auto rounded-lg pb-1 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </div>
  );
}
