"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  decryptMessage,
  encryptFile,
  decryptFile,
  encryptMessage,
  isAllowedMedia,
  MAX_MEDIA_BYTES,
} from "@/lib/crypto/e2ee";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDraft } from "@/hooks/use-draft";
import { subscribeConversation } from "@/components/messages/dm-realtime";
import { SwipeReply } from "@/components/messages/swipe-reply";
import { EmojiPicker } from "@/components/messages/emoji-picker";
import { ThemePicker, THEME_BUBBLE } from "@/components/messages/theme-picker";
import { CallButton } from "@/components/messages/call-button";

type WireMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  attachment_path: string | null;
};

type RenderMessage = {
  id: string;
  senderId: string;
  text: string;
  at: string;
  decryptFailed: boolean;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentPath: string | null;
  attachmentUrl: string | null;
};

const UNDECRYPTABLE = "🔒 Encrypted (cannot decrypt on this device)";

export function DmChatWindow({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<RenderMessage[]>([]);
  const [draftState, setDraftState] = useState("");
  const {
    draft: savedDraft,
    updateDraft,
    clearDraft,
  } = useDraft(`dm:${conversationId}`);
  const draft = draftState || savedDraft;
  const setDraft = (value: string) => {
    setDraftState(value);
    updateDraft(value);
  };
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peerPublicKeyRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [safety, setSafety] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/dm/conversations/${conversationId}/messages`,
    );

    if (!response.ok) {
      throw new Error("Could not load messages");
    }

    const data = (await response.json()) as {
      messages: WireMessage[];
      peerPublicKey: string | null;
    };
    peerPublicKeyRef.current = data.peerPublicKey;

    const peerPublicKey = data.peerPublicKey;

    const supabase = createSupabaseBrowserClient();
    async function mediaUrl(path: string | null): Promise<string | null> {
      if (!path) return null;
      const { data } = await supabase.storage.from("dm-media").download(path);
      if (!data) return null;
      const blob = await data.arrayBuffer();
      const wire = new TextDecoder().decode(blob);
      try {
        const plain = await decryptFile(peerPublicKey!, wire);
        return URL.createObjectURL(new Blob([plain]));
      } catch {
        return null;
      }
    }
    if (!peerPublicKey) {
      setMessages(
        data.messages.map((message) => ({
          id: message.id,
          senderId: message.sender_id,
          text: UNDECRYPTABLE,
          at: message.created_at,
          decryptFailed: true,
          attachmentName: message.attachment_name,
          attachmentMime: message.attachment_mime,
          attachmentPath: message.attachment_path,
          attachmentUrl: null,
        })),
      );
      return;
    }

    const decrypted = await Promise.all(
      data.messages.map(async (message) => {
        try {
          const text = await decryptMessage(peerPublicKey, message.body);
          const url = await mediaUrl(message.attachment_path);
          return {
            id: message.id,
            senderId: message.sender_id,
            text,
            at: message.created_at,
            decryptFailed: false,
            attachmentName: message.attachment_name,
            attachmentMime: message.attachment_mime,
            attachmentPath: message.attachment_path,
            attachmentUrl: url,
          };
        } catch {
          return {
            id: message.id,
            senderId: message.sender_id,
            text: UNDECRYPTABLE,
            at: message.created_at,
            decryptFailed: true,
            attachmentName: message.attachment_name,
            attachmentMime: message.attachment_mime,
            attachmentPath: message.attachment_path,
            attachmentUrl: null,
          };
        }
      }),
    );
    setMessages(decrypted);
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad(): Promise<void> {
      try {
        await load();
      } catch {
        if (!cancelled) {
          setError("Could not load messages");
        }
      }
    }

    void initialLoad();

    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime (postgres_changes + presence) + mark read
  const [online, setOnline] = useState(false);
  useEffect(() => {
    fetch(`/api/dm/conversations/${conversationId}/read`, {
      method: "POST",
    }).catch(() => {});
    const unsubscribe = subscribeConversation(
      conversationId,
      () => void load(),
      (typing) => setPeerTyping(typing),
      (isOnline) => setOnline(isOnline),
    );
    return unsubscribe;
  }, [conversationId, load]);

  useEffect(() => {
    if (!peerPublicKeyRef.current) return;
    import("@/lib/crypto/e2ee")
      .then(async (m) => {
        setSafety(await m.getSafetyFingerprint(peerPublicKeyRef.current!));
      })
      .catch(() => {});
  }, [messages.length]);

  async function recordVoice(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.start();
      setTimeout(() => recorder.stop(), 15000);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
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

  async function sendFile(file: File): Promise<void> {
    setUploading(true);
    setError(null);
    try {
      const peerPublicKey = peerPublicKeyRef.current;
      if (!peerPublicKey) throw new Error("Peer key not ready");
      if (file.size > MAX_MEDIA_BYTES) throw new Error("File max 25MB");
      if (
        !isAllowedMedia(file.type) &&
        file.type !== "application/octet-stream"
      )
        throw new Error("Type not allowed (image/video/pdf/audio)");
      const supabase = createSupabaseBrowserClient();
      const buf = await file.arrayBuffer();
      const wire = await encryptFile(peerPublicKey, buf);
      const path = `${conversationId}/${crypto.randomUUID()}.enc`;
      const { error: upErr } = await supabase.storage
        .from("dm-media")
        .upload(path, wire, { contentType: "text/plain" });
      if (upErr) throw upErr;
      const ciphertext = await encryptMessage(peerPublicKey, `📎 ${file.name}`);
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages`,
        {
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
        },
      );
      if (!response.ok) throw new Error("Could not send file");
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function send(): Promise<void> {
    const text = draft.trim();

    if (!text || sending) {
      return;
    }

    if (text.length > 2000) {
      setError("Message max 2000 characters");
      return;
    }

    const peerPublicKey = peerPublicKeyRef.current;

    if (!peerPublicKey) {
      setError("Peer encryption key not available yet — retry shortly");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const ciphertext = await encryptMessage(peerPublicKey, text);
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciphertext }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message =
          data && typeof data.error === "string"
            ? data.error
            : "Could not send message";

        throw new Error(message);
      }

      setDraft("");
      await load();
      router.refresh();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send message",
      );
    } finally {
      setSending(false);
    }
  }

  async function block(): Promise<void> {
    if (
      !window.confirm("Block this user? You will no longer be able to chat.")
    ) {
      return;
    }

    await fetch(`/api/dm/conversations/${conversationId}/block`, {
      method: "POST",
    });
    router.push("/messages");
    router.refresh();
  }

  const [theme, setTheme] = useState("default");
  const [emojiFor, setEmojiFor] = useState<string | null>(null);

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="flex items-center justify-between border-b pb-3">
        <p className="text-muted-foreground text-xs">
          🔒 E2E encrypted{safety ? ` • Safety: ${safety}` : ""}
          {peerTyping ? " • typing…" : ""}
          {online ? " • online" : ""}
        </p>
        <div className="flex items-center gap-2">
          <ThemePicker
            value={theme}
            onChange={setTheme}
          />
          <CallButton conversationId={conversationId} />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void block()}
          >
            Block
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((message, index) => (
            <SwipeReply
              key={message.id}
              onReply={() => setReplyTo(message.id)}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm ${THEME_BUBBLE[theme] ?? THEME_BUBBLE.default}`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                {message.attachmentUrl ? (
                  message.attachmentMime?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- attachment is a decrypted blob: URL, which next/image cannot optimize
                    <img
                      src={message.attachmentUrl}
                      alt={message.attachmentName ?? "attachment"}
                      className="mt-2 max-h-64 rounded"
                    />
                  ) : message.attachmentMime?.startsWith("video/") ? (
                    <video
                      src={message.attachmentUrl}
                      controls
                      className="mt-2 max-h-64 rounded"
                    />
                  ) : (
                    <a
                      href={message.attachmentUrl}
                      download={message.attachmentName ?? "file"}
                      className="text-accent mt-2 block text-xs underline"
                    >
                      📎 {message.attachmentName ?? "Download file"}
                    </a>
                  )
                ) : message.attachmentName ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    📎 {message.attachmentName} (decrypt failed)
                  </p>
                ) : null}
                <div className="mt-1 flex gap-2 text-xs">
                  <button
                    className="underline"
                    onClick={() => setReplyTo(message.id)}
                  >
                    Reply
                  </button>
                  <div className="relative">
                    <button
                      className="underline"
                      onClick={() => setEmojiFor(message.id)}
                    >
                      ❤️
                    </button>
                    {emojiFor === message.id ? (
                      <EmojiPicker
                        onPick={async (emoji) => {
                          await fetch(
                            `/api/dm/conversations/${conversationId}/messages/${message.id}/react`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ emoji }),
                            },
                          ).catch(() => {});
                          setEmojiFor(null);
                          await load();
                          router.refresh();
                        }}
                        onClose={() => setEmojiFor(null)}
                      />
                    ) : null}
                  </div>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {new Date(message.at).toLocaleString()}{" "}
                  {index === messages.length - 1 ? "Seen" : "✓✓"}
                </p>
              </div>
            </SwipeReply>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

      <form
        className="flex gap-2 border-t pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Input
          value={draft}
          maxLength={2000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message…"
          aria-label="Message"
        />
        <label className="flex items-center">
          <Input
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.zip,.txt"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void sendFile(file);
              event.target.value = "";
            }}
            aria-label="Attach file"
            className="hidden"
          />
          <span className="cursor-pointer rounded border px-2 py-1 text-sm">
            📎
          </span>
        </label>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void recordVoice()}
        >
          🎤
        </Button>
        <Button
          type="submit"
          disabled={sending || !draft.trim()}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
