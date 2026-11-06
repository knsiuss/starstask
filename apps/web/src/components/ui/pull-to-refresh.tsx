"use client";

/**
 * Pull-to-refresh for mobile shells (dashboard etc.).
 *
 * Only engages within scrolled-to-top containers: drag down past the
 * threshold to reload. Desktop is unaffected (pointer events never trigger
 * it), and `prefers-reduced-motion` disables the animation.
 *
 * Refresh itself shows the brand mark spinning like X's logo pop — then a
 * short fade-in on the children re-triggers the key change.
 */

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { BrandMark } from "@/components/layout/brand-mark";

const PTR_THRESHOLD = 72;
const REFRESH_ANIM_MS = 900;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const startY = useRef<number | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    if (refreshing) {
      startY.current = null;
      return;
    }

    const target = event.currentTarget as HTMLElement;

    if (target.scrollTop > 0) {
      startY.current = null;
      return;
    }

    startY.current = event.touches[0]?.clientY ?? null;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (startY.current === null || refreshing) {
      return;
    }

    const current = event.touches[0]?.clientY ?? startY.current;
    const delta = current - startY.current;

    setPull(delta > 0 ? Math.min(delta, PTR_THRESHOLD * 1.5) : 0);
  }

  function onTouchEnd() {
    if (pull >= PTR_THRESHOLD && !refreshing) {
      setRefreshing(true);
      router.refresh();

      window.setTimeout(() => {
        setRefreshing(false);
        setRefreshKey((count) => count + 1);
      }, REFRESH_ANIM_MS);
    }

    startY.current = null;
    setPull(0);
  }

  const showIndicator = pull > 0 || refreshing;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="overflow-hidden">
        <div
          aria-hidden="true"
          className="flex items-center justify-center transition-[height,opacity]"
          style={{
            height: showIndicator ? 56 : 0,
            opacity: pull > PTR_THRESHOLD * 0.5 || refreshing ? 1 : 0,
          }}
        >
          <span className="flex items-center gap-2 py-2">
            <BrandMark
              size={28}
              className={
                refreshing
                  ? "st-refresh-orbit"
                  : pull >= PTR_THRESHOLD
                    ? "st-refresh-armed"
                    : undefined
              }
            />
            <span className="text-muted-foreground text-xs font-medium">
              {refreshing
                ? "Refreshing…"
                : pull >= PTR_THRESHOLD
                  ? "Release to refresh"
                  : "Pull to refresh"}
            </span>
          </span>
        </div>
        <div
          key={refreshKey}
          className="st-fade-up"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
