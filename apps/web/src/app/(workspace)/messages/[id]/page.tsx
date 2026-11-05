import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DmChatWindow } from "@/components/messages/dm-chat-window";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Chat",
  description: "End-to-end encrypted chat.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ChatPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Chat</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/messages"));
  }

  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/messages"
        className="text-muted-foreground text-sm hover:underline"
      >
        ← All messages
      </Link>
      <div className="mt-4">
        <DmChatWindow conversationId={id} />
      </div>
    </div>
  );
}
