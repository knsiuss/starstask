import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ForwardPanel } from "@/components/leave/forward-panel";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import { listLeaveRequestsForClass } from "@/lib/db/leave";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { LEAVE_FORWARDING_MAX_REQUESTS } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Forward absence requests",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ForwardPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ForwardLeaveRequestsPage({
  params,
}: ForwardPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();
  const { slug } = await params;

  if (!session) {
    redirect(
      buildLoginPath(`/dashboard/classes/${slug}/leave-requests/forward`),
    );
  }

  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const role = await getClassRole(found.id);

  if (!role.canManage) {
    notFound();
  }

  // Only `submitted` requests can be forwarded: a draft is unfinished, a
  // cancelled one is closed, and a forwarded one is already in a package.
  const forwardable = await listLeaveRequestsForClass(found.id, {
    status: "submitted",
    page: 1,
    pageSize: LEAVE_FORWARDING_MAX_REQUESTS,
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10">
      <Link
        href={`/dashboard/classes/${found.slug}/leave-requests`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Class requests
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
          Forward to the lecturer
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
          Pick the requests to include, choose a report, and generate the
          package for {found.name}. The file downloads to your device —
          StarsTask does not email it.
        </p>
      </header>

      <Alert
        variant="info"
        className="mt-5"
      >
        <p className="font-medium">What happens when you generate a package</p>
        <ul className="mt-1 grid list-disc gap-0.5 pl-5 text-sm">
          <li>The included requests are marked as forwarded.</li>
          <li>
            A record is kept with the recipient, the report reference, and who
            generated it.
          </li>
          <li>
            Nothing is approved. The lecturer still decides, and StarsTask
            cannot tell you whether they received the file.
          </li>
        </ul>
      </Alert>

      <Alert
        variant="warning"
        className="mt-3"
      >
        <p className="font-medium">The package contains medical information</p>
        <p className="mt-1">
          Only send it to the lecturer named below, over a channel you trust.
        </p>
      </Alert>

      <div className="mt-6">
        <ForwardPanel
          classSlug={found.slug}
          requests={forwardable.items}
          defaultRecipient={found.lecturer_name ?? ""}
        />
      </div>
    </div>
  );
}
