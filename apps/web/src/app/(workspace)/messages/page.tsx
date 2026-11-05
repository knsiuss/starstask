import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DmKeySetup } from "@/components/messages/dm-key-setup";
import { DmUserSearch } from "@/components/messages/dm-user-search";
import { StoryRow } from "@/components/messages/story-row";
import { ConversationList } from "@/components/messages/conversation-list";
import { BackupKeyButton } from "@/components/messages/backup-key";
import { getSessionUser } from "@/lib/auth/session";
import { listConversations } from "@/lib/db/direct-messages";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { SetupNotice } from "@/components/layout/setup-notice";

export const metadata: Metadata = {
  title: "Messages",
  description: "End-to-end encrypted direct messages.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
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

  const conversations = await listConversations();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            End-to-end encrypted. The server stores ciphertext only.
          </p>
        </div>
        <DmKeySetup />
      </div>

      <StoryRow />

      <DmUserSearch />

      <BackupKeyButton />

      <div className="mt-6">
        <ConversationList conversations={conversations} />
      </div>
    </div>
  );
}
