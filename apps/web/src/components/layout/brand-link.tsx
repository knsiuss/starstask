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
        <span className="block text-[16px] leading-tight font-semibold tracking-tight text-foreground dark:text-[#efede7]">
          StarsTask
        </span>
        {showTagline ? (
          <span className="text-muted-foreground block text-[11px] leading-tight dark:text-[#a19d92]">
            Academic workspace
          </span>
        ) : null}
      </span>
    </Link>
  );
}
