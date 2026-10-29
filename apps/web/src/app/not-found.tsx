import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <Compass
        aria-hidden="true"
        className="text-muted-foreground h-10 w-10"
      />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        The page you are looking for does not exist, or the assignment is no
        longer available.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/assignments">Explore assignments</Link>
        </Button>
        <Button
          asChild
          variant="secondary"
        >
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
