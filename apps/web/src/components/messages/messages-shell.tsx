"use client";

import { MessageCircleHeart, PencilLine } from "lucide-react";
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
    <div className="border-border/60 bg-surface flex h-[calc(100dvh-8rem)] min-h-[540px] overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(69,99,158,0.08)] lg:h-[calc(100dvh-6rem)]">
      <section
        aria-label="Conversation list"
        className={
          selected
            ? "hidden w-full lg:block lg:w-[400px] lg:shrink-0 lg:border-r lg:border-border/60"
            : "w-full border-border/60 lg:w-[400px] lg:shrink-0 lg:border-r"
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
          <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
            <div className="bg-accent-soft flex h-20 w-20 items-center justify-center rounded-3xl">
              <MessageCircleHeart
                aria-hidden="true"
                className="text-accent h-10 w-10"
              />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">
              Your conversations start here.
            </h2>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Choose a conversation or start a new message with your classmates.
            </p>
            <button
              type="button"
              className="bg-accent hover:bg-accent-hover mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
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
