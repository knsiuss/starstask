import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { DmKeySetup } from "@/components/messages/dm-key-setup";
import { MessagesShell } from "@/components/messages/messages-shell";
import { getSessionUser } from "@/lib/auth/session";
import { listConversations } from "@/lib/db/direct-messages";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

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

  // Full-bleed workspace: no outer card, no centered container, no top
  // encryption/user-search clutter. DmKeySetup runs silently so device keys
  // exist before the first message; user search lives in the compose panel.
  return (
    <div className="flex h-[calc(100dvh-8rem)] w-full flex-col lg:h-[calc(100dvh-4rem)]">
      <DmKeySetup />
      {/* Server stores ciphertext only; decryption happens in the browser. */}
      <MessagesShell
        conversations={conversations}
        myUserId={session.user.id}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
