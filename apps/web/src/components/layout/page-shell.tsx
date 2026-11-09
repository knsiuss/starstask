import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Single page rhythm for workspace pages outside the dashboard / assignments /
 * classes / attendance surfaces.
 *
 * Every page renders its content inside `<PageShell width={...}>`:
 *   canvas, dashboard-grade wide canvas (max-w-[1400px], px-3 sm:px-6 lg:px-8, py-4 sm:py-8)
 *   wide, list / overview pages (max-w-6xl, px-4 sm:px-6 lg:px-8, py-5 sm:py-8)
 *   narrow, forms / single-column detail (max-w-3xl, px-4 sm:px-6, py-8 sm:py-10)
 *   form, short forms (max-w-2xl, px-4 sm:px-6, py-8 sm:py-10)
 *   reading, very short text pages (max-w-xl, px-4 sm:px-6, py-8 sm:py-10)
 */
const WIDTH_CLASSES = {
  canvas: "mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-6 sm:py-8 lg:px-8",
  wide: "mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8",
  narrow: "mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10",
  form: "mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10",
  reading: "mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-10",
} as const;

export type PageWidth = keyof typeof WIDTH_CLASSES;

type PageShellProps = {
  children: ReactNode;
  width?: PageWidth;
  className?: string;
};

export function PageShell({
  children,
  width = "wide",
  className,
}: PageShellProps) {
  return <div className={cn(WIDTH_CLASSES[width], className)}>{children}</div>;
}
