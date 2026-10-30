import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ForwardingHistory } from "@/components/leave/leave-history";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import { listLeaveForwardings } from "@/lib/db/leave";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Forwarding history",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ForwardingHistoryPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ForwardingHistoryPage({
  params,
}: ForwardingHistoryPageProps) {
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
      buildLoginPath(`/dashboard/classes/${slug}/leave-requests/history`),
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

  const records = await listLeaveForwardings(found.id);

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
          Forwarding history
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
          Every package generated for {found.name}, with the requests it
          carried. Records are append-only.
        </p>
      </header>

      <div className="mt-6">
        <ForwardingHistory records={records} />
      </div>
    </div>
  );
}
