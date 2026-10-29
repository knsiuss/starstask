import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const alertVariants = cva("rounded-md border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-border bg-subtle text-foreground",
      error: "border-danger/30 bg-danger-soft text-danger",
      success: "border-success/30 bg-success-soft text-success",
      warning: "border-warning/30 bg-warning-soft text-warning",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

export type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants>;

export function Alert({ className, variant, ...props }: AlertProps) {
  const isAssertive = variant === "error" || variant === "warning";

  return (
    <div
      role={isAssertive ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
