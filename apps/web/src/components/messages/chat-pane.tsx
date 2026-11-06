"use client";

import {
  ArrowLeft,
  Check,
  CheckCheck,
  Ellipsis,
  Info,
  Lock,
  Mic,
  Paperclip,
  Plus,
  Search,
  SendHorizonal,
  Smile,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmojiPicker } from "@/components/messages/emoji-picker";
import { KeyTrustBanner } from "@/components/messages/key-trust-banner";
import { PresenceDot } from "@/components/messages/presence-dot";
import { subscribeConversation } from "@/components/messages/dm-realtime";
import { SwipeReply } from "@/components/messages/swipe-reply";
import {
  buildAad,
  decryptFile,
  decryptMessage,
  decryptWithDataKey,
  encryptFile,
  encryptMessage,
  encryptWithDataKey,
  generateDataKey,
  getOrCreateKeyPair,
  isAllowedMedia,
  isReplay,
  MAX_MEDIA_BYTES,
  unwrapDataKey,
  wrapDataKey,
} from "@/lib/crypto/e2ee";
import type { ConversationRow } from "@/lib/db/direct-messages";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  dayKey,
  formatDatePill,
  formatTime,
  initials,
} from "@/lib/messages/format";
import { useDraft } from "@/hooks/use-draft";

export type MessageState = "sending" | "sent" | "read" | "failed";
export type RenderMessage = {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  at: string;
  state: MessageState;
  decryptFailed: boolean;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentUrl: string | null;
  replyToId: string | null;
  reactions: Record<string, number>;
  edited: boolean;
  pinned?: boolean;
};

type WireMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  attachment_path: string | null;
  group_wraps?: Record<string, { iv: string; cipher: string }> | null;
  reply_to_id?: string | null;
  edited_at?: string | null;
  is_pinned?: boolean;
};

const UNDECRYPTABLE = "Encrypted (cannot decrypt on this device)";
const PAGE_SIZE = 50;

type Props = {
  conversation: ConversationRow;
  myUserId: string;
  onBack: () => void;
  onPresence: (userId: string, online: boolean) => void;
};

export function ChatPane({
  conversation,
  myUserId,
  onBack,
  onPresence,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<RenderMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draftState, setDraftState] = useState("");
  const {
    draft: savedDraft,
    updateDraft,
    clearDraft,
  } = useDraft(`dm:${conversation.id}`);
  const draft = draftState || savedDraft;
  const setDraft = (value: string) => {
    setDraftState(value);
    updateDraft(value);
  };
  const [error, setError] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const [replyTo, setReplyTo] = useState<RenderMessage | null>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<RenderMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const peerPublicKeyRef = useRef<string | null>(null);
  const [peerPublicKey, setPeerPublicKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);
  const [participants, setParticipants] = useState<
    { userId: string; name: string }[]
  >([]);
  const memberKeysRef = useRef<Record<string, string>>({});

  const conversationId = conversation.id;

  const mapWire = useCallback(
    async (wire: WireMessage[], peerPublicKey: string | null) => {
      const supabase = createSupabaseBrowserClient();
      const nameById = new Map(participants.map((p) => [p.userId, p.name]));
      const memberKeys = memberKeysRef.current;
      const group = conversation.isGroup;
      return Promise.all(
        wire.map(async (message) => {
          let text = UNDECRYPTABLE;
          let decryptFailed = true;
          let attachmentUrl: string | null = null;

          // Replay guard: the same wire twice in one conversation is a
          // resend/replay, not a new message.
          if (await isReplay(conversationId, message.body)) {
            return {
              id: message.id,
              senderId: message.sender_id,
              senderName: nameById.get(message.sender_id),
              text: "Duplicate message ignored",
              at: message.created_at,
              state: "read" as MessageState,
              decryptFailed: true,
              attachmentName: message.attachment_name,
              attachmentMime: message.attachment_mime,
              attachmentUrl,
              replyToId: message.reply_to_id ?? null,
              reactions: {},
              edited: false,
            } satisfies RenderMessage;
          }

          if (group && message.group_wraps && memberKeys) {
            try {
              const envelope = (
                message.group_wraps as Record<
                  string,
                  { iv: string; cipher: string }
                >
              )[myUserId];
              if (envelope) {
                const selfPair = await getOrCreateKeyPair();
                const senderKey = memberKeys[message.sender_id] ?? "";
                const dataKey = await unwrapDataKey(
                  selfPair,
                  senderKey,
                  envelope,
                );
                text = await decryptWithDataKey(
                  dataKey,
                  message.body,
                  buildAad(conversationId, message.sender_id),
                );
                decryptFailed = false;
              }
            } catch {
              text = UNDECRYPTABLE;
            }
          } else if (peerPublicKey) {
            try {
              text = await decryptMessage(peerPublicKey, message.body, {
                conversationId,
                senderId: message.sender_id,
              });
              decryptFailed = false;
              if (message.attachment_path) {
                const { data } = await supabase.storage
                  .from("dm-media")
                  .download(message.attachment_path);
                if (data) {
                  const blob = await data.arrayBuffer();
                  const wireText = new TextDecoder().decode(blob);
                  const plain = await decryptFile(peerPublicKey, wireText);
                  attachmentUrl = URL.createObjectURL(
                    new Blob([plain], {
                      type:
                        message.attachment_mime ?? "application/octet-stream",
                    }),
                  );
                }
              }
            } catch {
              text = UNDECRYPTABLE;
            }
          }
          return {
            id: message.id,
            senderId: message.sender_id,
            senderName: nameById.get(message.sender_id),
            text,
            at: message.created_at,
            state: "read" as MessageState,
            decryptFailed,
            attachmentName: message.attachment_name,
            attachmentMime: message.attachment_mime,
            attachmentUrl,
            replyToId: message.reply_to_id ?? null,
            reactions: {},
            edited: Boolean(message.edited_at),
            pinned: Boolean(message.is_pinned),
          } satisfies RenderMessage;
        }),
      );
    },
    [participants, conversationId, conversation.isGroup, myUserId],
  );

  const loadPage = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (before) params.set("before", before);
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages?${params}`,
      );
      if (!response.ok) throw new Error("Could not load messages");
      const data = (await response.json()) as {
        messages: WireMessage[];
        peerPublicKey: string | null;
        participants?: { userId: string; name: string }[];
        memberKeys?: Record<string, string>;
        hasMore?: boolean;
      };
      peerPublicKeyRef.current = data.peerPublicKey;
      setPeerPublicKey(data.peerPublicKey);
      if (data.participants) setParticipants(data.participants);
      if (data.memberKeys) memberKeysRef.current = data.memberKeys;
      setHasMore(Boolean(data.hasMore));
      const rendered = await mapWire(data.messages, data.peerPublicKey);
      return rendered;
    },
    [conversationId, mapWire],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rendered = await loadPage();
        if (!cancelled) setMessages(rendered);
      } catch {
        if (!cancelled) setError("Could not load messages");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  useEffect(() => {
    fetch(`/api/dm/conversations/${conversationId}/read`, {
      method: "POST",
    }).catch(() => {});
    const unsubscribe = subscribeConversation(
      conversationId,
      () => {
        loadPage()
          .then(setMessages)
          .catch(() => {});
        router.refresh();
      },
      setPeerTyping,
      (isOnline) => {
        setOnline(isOnline);
        onPresence(conversation.otherUserId, isOnline);
      },
    );
    return unsubscribe;
  }, [conversationId, loadPage, onPresence, router, conversation.otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      const first = messages[0];
      if (!first) return;
      const older = await loadPage(first.at);
      setMessages((current) => [...older, ...current]);
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - previousHeight;
        }
      });
    } catch {
      setError("Could not load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadPage, loadingOlder, messages]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 3000) return;
    lastTypingSent.current = now;
    fetch(`/api/dm/conversations/${conversationId}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_typing: true }),
    }).catch(() => {});
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      fetch(`/api/dm/conversations/${conversationId}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_typing: false }),
      }).catch(() => {});
    }, 3500);
  }, [conversationId]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text) return;
    const peerPublicKey = peerPublicKeyRef.current;
    if (!peerPublicKey) {
      setError(
        "Waiting for the other person to sign in — their encryption key is not published yet. Try again in a moment.",
      );
      return;
    }
    const group = conversation.isGroup;
    const memberKeys = memberKeysRef.current;
    if (group && Object.keys(memberKeys).length === 0) {
      setError(
        "Waiting for group members to sign in — their encryption keys are not published yet. Try again in a moment.",
      );
      return;
    }
    const optimistic: RenderMessage = {
      id: `local-${Date.now()}`,
      senderId: myUserId,
      text,
      at: new Date().toISOString(),
      state: "sending",
      decryptFailed: false,
      attachmentName: null,
      attachmentMime: null,
      attachmentUrl: null,
      replyToId: replyTo?.id ?? null,
      reactions: {},
      edited: false,
    };
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setReplyTo(null);
    clearDraft();
    try {
      let ciphertext: string;
      let groupWraps:
        Record<string, { iv: string; cipher: string }> | undefined;

      if (group) {
        // Per-recipient envelopes: one data key, wrapped for every member
        // (including self, so the sender can decrypt own messages).
        const dataKey = await generateDataKey();
        const selfPair = await getOrCreateKeyPair();
        const aad = buildAad(conversationId, myUserId);
        ciphertext = await encryptWithDataKey(dataKey, text, aad);
        groupWraps = {};
        const wrapped = await Promise.all(
          Object.entries(memberKeys).map(async ([memberId, memberKey]) => [
            memberId,
            await wrapDataKey(selfPair, memberKey, dataKey),
          ]),
        );
        groupWraps = Object.fromEntries(wrapped);
      } else {
        ciphertext = await encryptMessage(peerPublicKey, text, {
          conversationId,
          senderId: myUserId,
        });
      }

      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciphertext, groupWraps }),
        },
      );
      if (!response.ok) throw new Error("Could not send message");
      setMessages((current) =>
        current.map((m) =>
          m.id === optimistic.id ? { ...m, state: "sent" as const } : m,
        ),
      );
      router.refresh();
    } catch (sendError) {
      setMessages((current) =>
        current.map((m) =>
          m.id === optimistic.id ? { ...m, state: "failed" as const } : m,
        ),
      );
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send message",
      );
    }
  }

  async function retry(message: RenderMessage): Promise<void> {
    setMessages((current) =>
      current.map((m) =>
        m.id === message.id ? { ...m, state: "sending" as const } : m,
      ),
    );
    const peerPublicKey = peerPublicKeyRef.current;
    if (!peerPublicKey) return;
    try {
      const ciphertext = await encryptMessage(peerPublicKey, message.text, {
        conversationId,
        senderId: myUserId,
      });
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciphertext }),
        },
      );
      if (!response.ok) throw new Error("Retry failed");
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id ? { ...m, state: "sent" as const } : m,
        ),
      );
    } catch {
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id ? { ...m, state: "failed" as const } : m,
        ),
      );
    }
  }

  async function react(messageId: string, emoji: string): Promise<void> {
    await fetch(
      `/api/dm/conversations/${conversationId}/messages/${messageId}/react`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      },
    ).catch(() => {});
    setMessages((current) =>
      current.map((m) =>
        m.id === messageId
          ? {
              ...m,
              reactions: {
                ...m.reactions,
                [emoji]: (m.reactions[emoji] ?? 0) + 1,
              },
            }
          : m,
      ),
    );
    setEmojiFor(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editing || !editText.trim()) return;
    const peerPublicKey = peerPublicKeyRef.current;
    if (!peerPublicKey) return;
    try {
      const ciphertext = await encryptMessage(peerPublicKey, editText.trim(), {
        conversationId,
        senderId: myUserId,
      });
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciphertext }),
        },
      );
      if (!response.ok) throw new Error("Edit failed");
      setMessages((current) =>
        current.map((m) =>
          m.id === editing.id
            ? { ...m, text: editText.trim(), edited: true }
            : m,
        ),
      );
      setEditing(null);
    } catch {
      setError("Could not edit message");
    }
  }

  async function remove(messageId: string): Promise<void> {
    await fetch(
      `/api/dm/conversations/${conversationId}/messages/${messageId}`,
      { method: "DELETE" },
    ).catch(() => {});
    setMessages((current) => current.filter((m) => m.id !== messageId));
  }

  async function copyMessage(message: RenderMessage): Promise<void> {
    try {
      await navigator.clipboard.writeText(message.text);
      setError("Copied to clipboard");
      window.setTimeout(() => setError(null), 2000);
    } catch {
      setError("Could not copy message");
    }
  }

  async function togglePin(message: RenderMessage): Promise<void> {
    const pinned = !message.pinned;
    await fetch(
      `/api/dm/conversations/${conversationId}/messages/${message.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      },
    ).catch(() => {});
    setMessages((current) =>
      current.map((m) => (m.id === message.id ? { ...m, pinned } : m)),
    );
  }

  async function sendFile(file: File): Promise<void> {
    const peerPublicKey = peerPublicKeyRef.current;
    if (!peerPublicKey) return;
    if (file.size > MAX_MEDIA_BYTES) {
      setError("File max 25MB");
      return;
    }
    if (
      !isAllowedMedia(file.type) &&
      file.type !== "application/octet-stream"
    ) {
      setError("Type not allowed (image/video/pdf/audio)");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const buf = await file.arrayBuffer();
    const wire = await encryptFile(peerPublicKey, buf);
    const path = `${conversationId}/${crypto.randomUUID()}.enc`;
    const { error: uploadError } = await supabase.storage
      .from("dm-media")
      .upload(path, wire, { contentType: "text/plain" });
    if (uploadError) {
      setError("Upload failed");
      return;
    }
    const ciphertext = await encryptMessage(peerPublicKey, file.name);
    await fetch(`/api/dm/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext,
        attachment: {
          name: file.name,
          mime: file.type,
          size: file.size,
          path,
        },
      }),
    });
    router.refresh();
  }

  async function recordVoice(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.start();
      window.setTimeout(() => recorder.stop(), 15000);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        await sendFile(file);
      };
    } catch {
      setError("Microphone permission denied");
    }
  }

  const filtered =
    searchQuery.trim().length > 0
      ? messages.filter((m) =>
          m.text.toLowerCase().includes(searchQuery.trim().toLowerCase()),
        )
      : messages;

  const grouped: { key: string; label: string; items: RenderMessage[] }[] = [];
  for (const message of filtered) {
    const key = dayKey(message.at);
    const lastGroup = grouped[grouped.length - 1];
    if (lastGroup?.key === key) {
      lastGroup.items.push(message);
    } else {
      grouped.push({
        key,
        label: formatDatePill(message.at),
        items: [message],
      });
    }
  }

  const replyTarget = replyTo
    ? (messages.find((m) => m.id === replyTo.id) ?? null)
    : null;

  const displayName = conversation.isGroup
    ? conversation.participantNames.join(", ") || conversation.otherName
    : conversation.otherName;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-border flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-5 w-5"
          />
        </button>
        <span className="relative shrink-0">
          <span className="from-accent to-accent-hover flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white">
            {initials(displayName)}
          </span>
          <PresenceDot online={online} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="text-muted-foreground truncate text-xs">
            {peerTyping
              ? "typing..."
              : online
                ? `Online${conversation.isGroup ? "" : " • Faculty"}`
                : "Offline"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Search in conversation"
            aria-pressed={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
            className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Search
              aria-hidden="true"
              className="h-5 w-5"
            />
          </button>
          <span className="relative">
            <button
              type="button"
              aria-label="Conversation information"
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen((open) => !open)}
              className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Info
                aria-hidden="true"
                className="h-5 w-5"
              />
            </button>
            {infoOpen ? (
              <span className="bg-surface border-border absolute top-full right-0 z-20 mt-2 flex w-64 items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed shadow-lg">
                <Lock
                  aria-hidden="true"
                  className="text-accent mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  Your messages are protected with end-to-end encryption. Only
                  you and the people you chat with can read them.
                </span>
              </span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label="More options"
            className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Ellipsis
              aria-hidden="true"
              className="h-5 w-5"
            />
          </button>
        </div>
      </header>

      <KeyTrustBanner
        conversationId={conversationId}
        peerPublicKey={peerPublicKey}
      />

      {searchOpen ? (
        <div className="border-border border-b px-4 py-2 sm:px-5">
          <label className="relative block">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search in conversation..."
              aria-label="Search in conversation"
              className="bg-muted/70 text-foreground placeholder:text-muted-foreground w-full rounded-full py-2 pr-4 pl-9 text-sm transition-colors focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={(event) => {
          if (event.currentTarget.scrollTop < 80) void loadOlder();
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
        aria-label="Messages"
      >
        {loadingOlder ? (
          <p className="text-muted-foreground py-2 text-center text-xs">
            Loading older messages...
          </p>
        ) : hasMore ? (
          <p className="text-muted-foreground py-2 text-center text-xs">
            Scroll up for older messages
          </p>
        ) : null}

        {messages.length === 0 && !error ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            No messages yet. Say hello!
          </p>
        ) : null}

        {grouped.map((group) => (
          <div key={group.key}>
            <div className="flex justify-center py-2">
              <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs">
                {group.label}
              </span>
            </div>
            <div>
              {group.items.map((message, index) => {
                const mine = message.senderId === myUserId;
                const reactionEntries = Object.entries(message.reactions);
                const previous = index > 0 ? group.items[index - 1] : undefined;
                const groupedWithPrevious = Boolean(
                  previous &&
                  previous.senderId === message.senderId &&
                  Date.parse(message.at) - Date.parse(previous.at) <=
                    5 * 60 * 1000,
                );
                return (
                  <div
                    key={message.id}
                    className={
                      index === 0 ? "" : groupedWithPrevious ? "mt-1" : "mt-3"
                    }
                  >
                    <SwipeReply onReply={() => setReplyTo(message)}>
                      <div
                        className={
                          mine
                            ? "message-in flex items-end justify-end gap-2"
                            : "message-in flex items-end gap-2"
                        }
                      >
                        {!mine && !groupedWithPrevious ? (
                          <span className="from-accent to-accent-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white">
                            {initials(message.senderName ?? displayName)}
                          </span>
                        ) : null}
                        <div className="max-w-[80%] sm:max-w-[60%]">
                          {!mine &&
                          conversation.isGroup &&
                          message.senderName &&
                          !groupedWithPrevious ? (
                            <p className="mb-0.5 px-1 text-[11px] font-medium text-accent dark:text-accent">
                              {message.senderName}
                            </p>
                          ) : null}
                          {message.replyToId ? (
                            <p className="text-muted-foreground mb-1 truncate px-1 text-[11px]">
                              Replying to a message
                            </p>
                          ) : null}
                          <div className="group relative">
                            <button
                              type="button"
                              aria-label={
                                message.state === "failed"
                                  ? "Failed to send. Tap to retry."
                                  : `Message from ${mine ? "you" : (message.senderName ?? displayName)}`
                              }
                              onClick={() => {
                                if (message.state === "failed") {
                                  void retry(message);
                                }
                              }}
                              className={
                                mine
                                  ? "block rounded-2xl rounded-br-md bg-gradient-to-br from-accent to-accent-hover px-4 py-2.5 text-left text-sm whitespace-pre-wrap text-white shadow-sm"
                                  : "block rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-left text-sm whitespace-pre-wrap text-foreground"
                              }
                            >
                              {editing?.id === message.id ? (
                                <span className="block">
                                  <textarea
                                    value={editText}
                                    onChange={(event) =>
                                      setEditText(event.target.value)
                                    }
                                    aria-label="Edit message"
                                    rows={2}
                                    className="w-full rounded bg-transparent text-inherit focus-visible:outline-2"
                                  />
                                  <span className="mt-1 flex gap-2">
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void saveEdit();
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter")
                                          void saveEdit();
                                      }}
                                      className="cursor-pointer text-xs font-semibold underline underline-offset-2"
                                    >
                                      Save
                                    </span>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setEditing(null);
                                      }}
                                      className="cursor-pointer text-xs underline underline-offset-2"
                                    >
                                      Cancel
                                    </span>
                                  </span>
                                </span>
                              ) : (
                                message.text
                              )}
                              {message.attachmentUrl ? (
                                message.attachmentMime?.startsWith("image/") ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- attachment previews use signed/blob URLs that next/image cannot optimize
                                  <img
                                    src={message.attachmentUrl}
                                    alt={message.attachmentName ?? "attachment"}
                                    className="mt-2 max-h-64 rounded-lg"
                                  />
                                ) : message.attachmentMime?.startsWith(
                                    "video/",
                                  ) ? (
                                  <video
                                    src={message.attachmentUrl}
                                    controls
                                    className="mt-2 max-h-64 rounded-lg"
                                  />
                                ) : message.attachmentMime?.startsWith(
                                    "audio/",
                                  ) ? (
                                  <audio
                                    src={message.attachmentUrl}
                                    controls
                                    className="mt-2 w-full max-w-56"
                                  />
                                ) : (
                                  <a
                                    href={message.attachmentUrl}
                                    download={message.attachmentName ?? "file"}
                                    className="mt-2 block text-xs underline underline-offset-2"
                                  >
                                    {message.attachmentName ?? "Download file"}
                                  </a>
                                )
                              ) : message.attachmentName ? (
                                <span className="mt-1 block text-xs opacity-70">
                                  {message.attachmentName} (decrypt failed)
                                </span>
                              ) : null}
                            </button>
                            <span className="mt-1 flex items-center gap-1 px-1">
                              <span className="text-muted-foreground text-[10px]">
                                {formatTime(message.at)}
                                {message.edited ? " (edited)" : ""}
                                {message.pinned ? " · pinned" : ""}
                              </span>
                              {mine ? (
                                message.state === "sending" ? (
                                  <span className="text-muted-foreground text-[10px]">
                                    Sending...
                                  </span>
                                ) : message.state === "failed" ? (
                                  <button
                                    type="button"
                                    onClick={() => void retry(message)}
                                    className="text-red-600 text-[10px] font-semibold underline underline-offset-2"
                                    aria-label="Retry sending message"
                                  >
                                    Failed, tap to retry
                                  </button>
                                ) : message.state === "read" ? (
                                  <CheckCheck
                                    aria-label="Read"
                                    className="h-3.5 w-3.5 text-accent"
                                  />
                                ) : (
                                  <Check
                                    aria-label="Sent"
                                    className="h-3.5 w-3.5 text-muted-foreground"
                                  />
                                )
                              ) : null}
                            </span>
                            {reactionEntries.length > 0 ? (
                              <span className="mt-0.5 flex flex-wrap gap-1 px-1">
                                {reactionEntries.map(([emoji, count]) => (
                                  <span
                                    key={emoji}
                                    className="bg-muted rounded-full px-1.5 py-0.5 text-[11px]"
                                  >
                                    {emoji} {count}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                            <span className="absolute -top-1 right-0 hidden gap-2 group-hover:flex">
                              <button
                                type="button"
                                aria-label="Reply to message"
                                onClick={() => setReplyTo(message)}
                                className="text-muted-foreground text-[11px] underline underline-offset-2"
                              >
                                Reply
                              </button>
                              <button
                                type="button"
                                aria-label="Copy message"
                                onClick={() => void copyMessage(message)}
                                className="text-muted-foreground text-[11px] underline underline-offset-2"
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                aria-label={
                                  message.pinned
                                    ? "Unpin message"
                                    : "Pin message"
                                }
                                onClick={() => void togglePin(message)}
                                className="text-muted-foreground text-[11px] underline underline-offset-2"
                              >
                                {message.pinned ? "Unpin" : "Pin"}
                              </button>
                              <span className="relative">
                                <button
                                  type="button"
                                  aria-label="React to message"
                                  onClick={() => setEmojiFor(message.id)}
                                  className="text-muted-foreground text-[11px] underline underline-offset-2"
                                >
                                  React
                                </button>
                                {emojiFor === message.id ? (
                                  <EmojiPicker
                                    onPick={(emoji) =>
                                      void react(message.id, emoji)
                                    }
                                    onClose={() => setEmojiFor(null)}
                                  />
                                ) : null}
                              </span>
                              {mine ? (
                                <>
                                  <button
                                    type="button"
                                    aria-label="Edit message"
                                    onClick={() => {
                                      setEditing(message);
                                      setEditText(message.text);
                                    }}
                                    className="text-muted-foreground text-[11px] underline underline-offset-2"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Delete message"
                                    onClick={() => void remove(message.id)}
                                    className="text-red-600 text-[11px] underline underline-offset-2"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : null}
                            </span>
                          </div>
                        </div>
                      </div>
                    </SwipeReply>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {peerTyping ? (
        <div
          aria-label="Typing"
          className="flex items-center gap-1 px-6 pb-1"
        >
          <span className="bg-muted flex items-center gap-1 rounded-full px-3 py-2">
            <span className="typing-dot bg-muted-foreground h-1.5 w-1.5 rounded-full" />
            <span className="typing-dot bg-muted-foreground h-1.5 w-1.5 rounded-full" />
            <span className="typing-dot bg-muted-foreground h-1.5 w-1.5 rounded-full" />
          </span>
        </div>
      ) : null}

      {replyTarget ? (
        <div className="border-border mx-4 flex items-start justify-between gap-3 rounded-xl border bg-muted/50 px-3 py-2 sm:mx-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-accent dark:text-accent">
              Replying to{" "}
              {replyTarget.senderId === myUserId
                ? "yourself"
                : (replyTarget.senderName ?? displayName)}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {replyTarget.text}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel reply"
            onClick={() => setReplyTo(null)}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {error ? (
        <p
          className="px-4 pt-2 text-sm text-red-600 sm:px-6"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form
        className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className="border-border/60 bg-surface flex items-end gap-1 rounded-3xl border px-2 py-2">
          <span className="relative shrink-0">
            <button
              type="button"
              aria-label="Emoji"
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((open) => !open)}
              className="text-muted-foreground hover:text-foreground flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Smile
                aria-hidden="true"
                className="h-5 w-5"
              />
            </button>
            {emojiOpen ? (
              <EmojiPicker
                onPick={(emoji) => {
                  setDraft(draft + emoji);
                  setEmojiOpen(false);
                  composerRef.current?.focus();
                }}
                onClose={() => setEmojiOpen(false)}
              />
            ) : null}
          </span>

          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Message</span>
            <textarea
              ref={composerRef}
              value={draft}
              maxLength={2000}
              rows={1}
              onChange={(event) => {
                setDraft(event.target.value);
                sendTyping();
                const target = event.currentTarget;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Write a message..."
              aria-label="Type a message"
              className="max-h-30 w-full resize-none bg-transparent px-2 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>

          <label className="flex h-10 w-10 shrink-0 items-center justify-center">
            <input
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.zip,.txt"
              className="sr-only"
              aria-label="Attach file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void sendFile(file);
                event.target.value = "";
              }}
            />
            <span className="text-muted-foreground hover:text-foreground flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
              <Paperclip
                aria-hidden="true"
                className="h-5 w-5"
              />
            </span>
          </label>

          <label className="flex h-10 w-10 shrink-0 items-center justify-center">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Send image"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void sendFile(file);
                event.target.value = "";
              }}
            />
            <span className="text-muted-foreground hover:text-foreground flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
              <Plus
                aria-hidden="true"
                className="h-5 w-5"
              />
            </span>
          </label>

          <button
            type="button"
            aria-label="Record voice message"
            onClick={() => void recordVoice()}
            className="text-muted-foreground hover:text-foreground hidden h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex"
          >
            <Mic
              aria-hidden="true"
              className="h-5 w-5"
            />
          </button>

          <button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim()}
            className="bg-accent hover:bg-accent-hover disabled:bg-accent/40 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <SendHorizonal
              aria-hidden="true"
              className="h-5 w-5"
            />
          </button>
        </div>
      </form>
    </div>
  );
}
