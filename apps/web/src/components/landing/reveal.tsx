"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/**
 * One purposeful motion for MOTION 2: a single fade-up that fires once on
 * mount and then stays put. Disabled under prefers-reduced-motion via the
 * global reduced-motion CSS block. No IntersectionObserver, no loops, no
 * stagger, no risk of content stuck at opacity 0.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <div
      className={cn("reveal", "is-visible", className)}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
