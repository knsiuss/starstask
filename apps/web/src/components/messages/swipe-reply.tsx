"use client";

import { useRef, useState } from "react";

/** Swipe-to-reply wrapper: drag right > 60px triggers onReply. Touch + mouse. */
export function SwipeReply({
  children,
  onReply,
}: {
  children: React.ReactNode;
  onReply: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    setOffset(Math.max(0, Math.min(dx, 80)));
  }
  function onPointerUp() {
    if (offset > 60) onReply();
    startX.current = null;
    setOffset(0);
  }

  return (
    <div
      className="relative [touch-action:pan-y]"
      style={{ transform: `translateX(${offset}px)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {offset > 10 ? (
        <span className="absolute -left-8 top-1/2 -translate-y-1/2">↩️</span>
      ) : null}
      {children}
    </div>
  );
}
