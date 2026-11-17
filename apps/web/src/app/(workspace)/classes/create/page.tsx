import { ArrowLeft, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateClassForm } from "@/components/classes/create-class-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Create a class",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CreateClassPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/classes/create"));
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-24 sm:px-6 sm:pb-12 lg:py-10">
      <Link
        href="/classes"
        className="text-muted-foreground hover:text-foreground focus-visible:outline-accent inline-flex min-h-[44px] items-center gap-1.5 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-0"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        My Classes
      </Link>

      <div className="border-border bg-surface mt-4 rounded-xl border p-5 sm:p-8">
        <span className="bg-accent-soft text-accent flex h-11 w-11 items-center justify-center rounded-md">
          <GraduationCap
            aria-hidden="true"
            className="h-5 w-5"
          />
        </span>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Create a class
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Classes are identified by semester, class code, and academic year so
          the same cohort class cannot be created twice.
        </p>

        <CreateClassForm />
      </div>
    </div>
  );
}
