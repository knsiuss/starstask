import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-accent flex min-h-28 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
