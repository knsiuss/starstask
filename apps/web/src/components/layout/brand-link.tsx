import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { cn } from "@/lib/utils/cn";

type BrandLinkProps = {
  className?: string;
  showTagline?: boolean;
};

export function BrandLink({ className, showTagline = false }: BrandLinkProps) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2", className)}
    >
      <BrandMark size={36} />
      <span className="min-w-0">
        <span className="block text-[15px] leading-tight font-semibold tracking-tight">
          StarsTask
        </span>
        {showTagline ? (
          <span className="text-muted-foreground block text-[11px] leading-tight">
            Academic workspace
          </span>
        ) : null}
      </span>
    </Link>
  );
}
