import { Star } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type BrandLinkProps = {
  className?: string;
  showTagline?: boolean;
};

export function BrandLink({ className, showTagline = false }: BrandLinkProps) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5", className)}
    >
      <span className="bg-accent text-accent-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
        <Star
          aria-hidden="true"
          className="h-[18px] w-[18px]"
          fill="currentColor"
          strokeWidth={1.5}
        />
      </span>
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
