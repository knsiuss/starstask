import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { MessagesShell } from "@/components/messages/messages-shell";
import { isBetaTester } from "@/lib/auth/beta";
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

  // Chat is a beta surface: only allowlisted beta testers see the shell.
  if (!(await isBetaTester())) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center sm:px-6">
        <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-2xl">
          <Lock
            aria-hidden="true"
            className="text-muted-foreground h-5 w-5"
          />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Messages are in beta
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          End-to-end encrypted chat is currently limited to beta testers. Your
          account is not on the beta list yet.
        </p>
        <Link
          href="/app"
          className="text-accent mt-5 text-sm font-medium underline underline-offset-2"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const conversations = await listConversations();

  // Full-bleed workspace: no outer card, no centered container, no top
  // encryption/user-search clutter. E2EE keys are set up by DmKeySetup in
  // WorkspaceLayout (runs on every workspace page), so device keys already
  // exist before the first message; user search lives in the compose panel.
  return (
    <div className="flex h-[calc(100dvh-8rem)] w-full flex-col lg:h-[calc(100dvh-4rem)]">
      {/* Server stores ciphertext only; decryption happens in the browser. */}
      <MessagesShell
        conversations={conversations}
        myUserId={session.user.id}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
