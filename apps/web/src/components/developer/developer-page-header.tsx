import Link from "next/link";

import { Button } from "@/components/ui/button";

export function DeveloperPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="border-border flex flex-wrap items-start justify-between gap-4 border-b pb-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
          {description}
        </p>
      </div>
      <Button
        asChild
        variant="secondary"
        size="sm"
      >
        <Link href="/developer">Back to overview</Link>
      </Button>
    </header>
  );
}
