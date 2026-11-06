"use client";

/**
 * Pull-to-refresh for mobile shells (dashboard etc.).
 *
 * Only engages within scrolled-to-top containers: drag down past the
 * threshold to reload. Desktop is unaffected (pointer events never trigger
 * it), and `prefers-reduced-motion` disables the animation.
 */

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

const PTR_THRESHOLD = 72;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    const target = event.currentTarget as HTMLElement;

    if (target.scrollTop > 0) {
      startY.current = null;
      return;
    }

    startY.current = event.touches[0]?.clientY ?? null;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (startY.current === null) {
      return;
    }

    const current = event.touches[0]?.clientY ?? startY.current;
    const delta = current - startY.current;

    setPull(delta > 0 ? Math.min(delta, PTR_THRESHOLD * 1.5) : 0);
  }

  function onTouchEnd() {
    if (pull >= PTR_THRESHOLD) {
      router.refresh();
    }

    startY.current = null;
    setPull(0);
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="overflow-hidden">
        <div
          aria-hidden="true"
          className="text-muted-foreground flex justify-center text-xs font-medium transition-[height,opacity]"
          style={{
            height: pull > 0 ? Math.min(pull, PTR_THRESHOLD) : 0,
            opacity: pull > PTR_THRESHOLD * 0.5 ? 1 : 0,
          }}
        >
          <span className="py-1">
            {pull >= PTR_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
