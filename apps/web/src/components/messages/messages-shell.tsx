"use client";

import { useCallback, useState } from "react";

import { ChatPane } from "@/components/messages/chat-pane";
import { ConversationListPanel } from "@/components/messages/conversation-list-panel";
import type { ConversationRow } from "@/lib/db/direct-messages";

type Props = {
  conversations: ConversationRow[];
  myUserId: string;
};

export function MessagesShell({ conversations, myUserId }: Props) {
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());

  const handleSelect = useCallback((conversation: ConversationRow) => {
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

  return (
    <div className="bg-surface flex h-[calc(100dvh-8rem)] min-h-[480px] overflow-hidden rounded-xl border lg:h-[calc(100dvh-6rem)]">
      <section
        aria-label="Conversation list"
        className={
          selected
            ? "hidden w-full lg:block lg:w-[340px] lg:shrink-0 lg:border-r"
            : "w-full lg:w-[340px] lg:shrink-0 lg:border-r"
        }
      >
        <ConversationListPanel
          conversations={conversations}
          selectedId={selected?.id ?? null}
          onlineIds={onlineIds}
          onSelect={handleSelect}
        />
      </section>

      <section
        aria-label="Chat"
        className={
          selected ? "min-w-0 flex-1" : "hidden min-w-0 flex-1 lg:flex"
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
          <div className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm">
            Select a conversation to start chatting.
          </div>
        )}
      </section>
    </div>
  );
}
