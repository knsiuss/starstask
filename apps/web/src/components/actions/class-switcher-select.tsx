"use client";

import type { ReactNode } from "react";

import { Select } from "@/components/ui/select";

type ClassSwitcherSelectProps = {
  id: string;
  name?: string;
  defaultValue: string;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Auto-submits its parent GET form when a class leader picks another class,
 * while keeping the form accessible to keyboard/non-JS submit.
 */
export function ClassSwitcherSelect({
  id,
  name = "class",
  defaultValue,
  ariaLabel,
  className,
  children,
}: ClassSwitcherSelectProps) {
  return (
    <Select
      id={id}
      name={name}
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      className={className}
      onChange={(event) => {
        event.currentTarget.form?.requestSubmit();
      }}
    >
      {children}
    </Select>
  );
}
