import { BookOpen } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CourseNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <BookOpen
        aria-hidden="true"
        className="text-muted-foreground h-10 w-10"
      />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Course not found
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This course does not exist, or it belongs to a class you have not
        joined.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/classes">My classes</Link>
        </Button>
        <Button
          asChild
          variant="secondary"
        >
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
