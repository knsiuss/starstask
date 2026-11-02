import Image from "next/image";

import { cn } from "@/lib/utils/cn";

/** Intrinsic size of `apps/web/public/brand/logo-mark.png`. */
const MARK_WIDTH = 992;
const MARK_HEIGHT = 810;

type BrandMarkProps = {
  /** Rendered height in pixels; the width follows the mark's aspect ratio. */
  size?: number;
  className?: string;
};

/**
 * The StarsTask mark: an open book under a four-point star.
 *
 * Decorative by design — every place that shows it also prints the wordmark, so
 * the image is hidden from assistive technology instead of repeating a name.
 */
export function BrandMark({ size = 32, className }: BrandMarkProps) {
  const width = Math.round((size * MARK_WIDTH) / MARK_HEIGHT);

  return (
    <Image
      src="/brand/logo-mark.png"
      alt=""
      aria-hidden="true"
      width={width}
      height={size}
      className={cn("shrink-0 select-none", className)}
      style={{ height: size, width }}
    />
  );
}
