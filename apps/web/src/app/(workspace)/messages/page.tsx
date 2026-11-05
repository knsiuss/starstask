import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DmKeySetup } from "@/components/messages/dm-key-setup";
import { DmUserSearch } from "@/components/messages/dm-user-search";
import { StoryRow } from "@/components/messages/story-row";
import { ConversationFilter } from "@/components/messages/message-search";
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
        {conversations.length === 0 ? (
          <p className="text-muted-foreground border border-dashed py-10 text-center text-sm">
            No conversations yet. Search above to start one.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {conversation.otherName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {conversation.lastMessage ?? "No messages"}
                    </p>
                  </div>
                  <span
                    className={
                      conversation.unread
                        ? "h-2 w-2 rounded-full bg-blue-600"
                        : "sr-only"
                    }
                    aria-label={conversation.unread ? "Unread" : ""}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
