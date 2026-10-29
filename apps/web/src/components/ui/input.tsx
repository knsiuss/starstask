import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Input({
  className,
  type = "text",
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "border-input bg-surface text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-accent flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
