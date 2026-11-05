"use client";

import { AArrowDown, AArrowUp } from "lucide-react";
import { useEffect } from "react";

const STORAGE_KEY = "starstask:font-scale";
const SIZES = ["0.875", "1", "1.125"] as const;
const DEFAULT_INDEX = 1;

export function FontSizeToggle() {
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const index = SIZES.indexOf(
      (stored ?? SIZES[DEFAULT_INDEX]) as (typeof SIZES)[number],
    );
    const safeIndex = index >= 0 ? index : DEFAULT_INDEX;
    document.documentElement.style.fontSize = `${Number(SIZES[safeIndex]) * 16}px`;
  }, []);

  function cycle(step: 1 | -1) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const current = SIZES.indexOf(
      (stored ?? SIZES[DEFAULT_INDEX]) as (typeof SIZES)[number],
    );
    const safeCurrent = current >= 0 ? current : DEFAULT_INDEX;
    const next = Math.min(
      SIZES.length - 1,
      Math.max(0, safeCurrent + step),
    );
    const size = SIZES[next] ?? SIZES[DEFAULT_INDEX];
    window.localStorage.setItem(STORAGE_KEY, size);
    document.documentElement.style.fontSize = `${Number(size) * 16}px`;
  }

  return (
    <span className="hidden items-center gap-0.5 sm:flex">
      <button
        type="button"
        aria-label="Decrease font size"
        onClick={() => cycle(-1)}
        className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
      >
        <AArrowDown aria-hidden="true" className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Increase font size"
        onClick={() => cycle(1)}
        className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
      >
        <AArrowUp aria-hidden="true" className="h-5 w-5" />
      </button>
    </span>
  );
}
