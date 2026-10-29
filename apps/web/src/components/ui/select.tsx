import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input bg-surface text-foreground focus-visible:border-accent focus-visible:outline-accent h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
