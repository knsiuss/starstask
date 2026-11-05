"use client";

import { MessageCircleHeart, PencilLine } from "lucide-react";
import { useCallback, useState } from "react";

import { ChatPane } from "@/components/messages/chat-pane";
import { ConversationListPanel } from "@/components/messages/conversation-list-panel";
import { DmUserSearch } from "@/components/messages/dm-user-search";
import type { ConversationRow } from "@/lib/db/direct-messages";
import { cn } from "@/lib/utils/cn";

type Props = {
  conversations: ConversationRow[];
  myUserId: string;
  className?: string;
};

export function MessagesShell({ conversations, myUserId, className }: Props) {
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [composing, setComposing] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());

  const handleSelect = useCallback((conversation: ConversationRow) => {
    setComposing(false);
    setSelected(conversation);
  }, []);

  const handleBack = useCallback(() => {
    setSelected(null);
  }, []);

  const handlePresence = useCallback((userId: string, online: boolean) => {
    setOnlineIds((current) => {
      const next = new Set(current);
      if (online) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, []);

  // Seamless two-pane workspace, no outer card, no boxed container.
  // Left pane is hidden on small screens once a chat opens; the chat's back
  // button restores it (mobile fullscreen-chat pattern).
  return (
    <div className={cn("bg-surface flex w-full overflow-hidden", className)}>
      <section
        aria-label="Conversation list"
        className={
          selected
            ? "hidden w-full sm:block sm:w-[340px] sm:shrink-0 sm:border-r sm:border-border/60 lg:w-[360px]"
            : "w-full sm:w-[340px] sm:shrink-0 sm:border-r sm:border-border/60 lg:w-[360px]"
        }
      >
        {composing ? (
          <DmUserSearch
            onClose={() => setComposing(false)}
            onSelect={handleSelect}
          />
        ) : (
          <ConversationListPanel
            conversations={conversations}
            selectedId={selected?.id ?? null}
            onlineIds={onlineIds}
            onSelect={handleSelect}
            onCompose={() => setComposing(true)}
          />
        )}
      </section>

      <section
        aria-label="Chat"
        className={
          selected ? "min-w-0 flex-1" : "hidden min-w-0 flex-1 sm:flex"
        }
      >
        {selected ? (
          <ChatPane
            key={selected.id}
            conversation={selected}
            myUserId={myUserId}
            onBack={handleBack}
            onPresence={handlePresence}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-2xl">
              <MessageCircleHeart
                aria-hidden="true"
                className="text-muted-foreground h-6 w-6"
              />
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">
              Your conversations start here.
            </h2>
            <p className="text-muted-foreground mt-1.5 max-w-xs text-sm leading-relaxed">
              Select a conversation to start chatting with your classmates.
            </p>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="bg-accent hover:bg-accent-hover mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <PencilLine
                aria-hidden="true"
                className="h-4 w-4"
              />
              New Message
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
