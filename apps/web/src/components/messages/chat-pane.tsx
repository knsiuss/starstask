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
  ShieldCheck,
  Smile,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmojiPicker } from "@/components/messages/emoji-picker";
import { EncryptedMediaAttachment } from "@/components/messages/encrypted-media-attachment";
import { KeyTrustBanner } from "@/components/messages/key-trust-banner";
import { PresenceDot } from "@/components/messages/presence-dot";
import { SafetyNumberDialog } from "@/components/messages/safety-number-dialog";
import { sanitizePeerMediaMimeType } from "@/components/messages/safe-media-mime";
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
  exportPublicKey,
  generateDataKey,
  getOrCreateDeviceId,
  getOrCreateKeyPair,
  getOrCreateSignedPrekey,
  isAllowedMedia,
  isReplay,
  MAX_MEDIA_BYTES,
  unwrapDataKey,
  wrapDataKey,
} from "@/lib/crypto/e2ee";
import { encryptMediaBytes } from "@/lib/crypto/e2ee-media";
import {
  importRawPublicKey,
  ratchetDecrypt,
  ratchetEncrypt,
  ratchetInitReceiver,
  ratchetInitSender,
} from "@/lib/crypto/e2ee-ratchet";
import {
  createIndexedDbRatchetStore,
  createSenderKeyState,
  decryptGroupMessage,
  deriveInitialSharedSecret,
  deriveResponderSharedSecret,
  encryptGroupMessage,
  parseV2Envelope,
  parseV2GroupEnvelope,
  type DecryptedPayload,
  type EncryptedMediaMeta,
  type RatchetStore,
  type V2DeviceEnvelope,
  serializeV2Envelope,
  serializeV2GroupEnvelope,
} from "@/lib/crypto/e2ee-v2";
import { registerCurrentDevice } from "@/lib/crypto/key-backup";
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
  encryptedMedia?: EncryptedMediaMeta | null;
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

type DeviceKeyInfo = {
  user_id: string;
  device_id: string;
  identity_public_key: string;
  signed_prekey_public: string;
  revoked_at: string | null;
};

type SenderKeyRecord = {
  owner_device_id: string;
  key_id: string;
  encrypted_sender_key: string;
};

const UNDECRYPTABLE = "Encrypted (cannot decrypt on this device)";
const PAGE_SIZE = 50;
const CACHE_DB_NAME = "starstask-e2ee-msg-cache";
const CACHE_STORE_NAME = "messages";

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB_NAME, 1);

    req.onupgradeneeded = (): void => {
      if (!req.result.objectStoreNames.contains(CACHE_STORE_NAME)) {
        req.result.createObjectStore(CACHE_STORE_NAME);
      }
    };
    req.onsuccess = (): void => resolve(req.result);
    req.onerror = (): void => reject(req.error);
  });
}

async function getCachedPayload(
  messageId: string,
): Promise<DecryptedPayload | null> {
  try {
    const db = await openCacheDb();

    return await new Promise<DecryptedPayload | null>((resolve, reject) => {
      const req = db
        .transaction(CACHE_STORE_NAME, "readonly")
        .objectStore(CACHE_STORE_NAME)
        .get(messageId);

      req.onsuccess = (): void =>
        resolve((req.result as DecryptedPayload | undefined) ?? null);
      req.onerror = (): void => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function setCachedPayload(
  messageId: string,
  payload: DecryptedPayload,
): Promise<void> {
  try {
    const db = await openCacheDb();

    await new Promise<void>((resolve, reject) => {
      const req = db
        .transaction(CACHE_STORE_NAME, "readwrite")
        .objectStore(CACHE_STORE_NAME)
        .put(payload, messageId);

      req.onsuccess = (): void => resolve();
      req.onerror = (): void => reject(req.error);
    });
  } catch {
    // Cache failure must not block decryption.
  }
}

function isEncryptedMediaMeta(value: unknown): value is EncryptedMediaMeta {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<EncryptedMediaMeta>;

  return (
    typeof candidate.storagePath === "string" &&
    typeof candidate.mimeType === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.fileSize === "number" &&
    typeof candidate.keyB64 === "string" &&
    typeof candidate.ivB64 === "string" &&
    typeof candidate.sha256B64 === "string"
  );
}

function parseDecryptedPayload(plaintext: string): DecryptedPayload {
  try {
    const parsed: unknown = JSON.parse(plaintext);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const hasText = typeof obj.text === "string";
      const hasMedia = isEncryptedMediaMeta(obj.media);

      if (hasText || hasMedia) {
        return {
          text: hasText ? (obj.text as string) : undefined,
          media: hasMedia ? (obj.media as EncryptedMediaMeta) : undefined,
        };
      }
    }
  } catch {
    // Plaintext was not JSON; treat as raw message string.
  }

  return { text: plaintext };
}

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
  const [notice, setNotice] = useState<string | null>(null);
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
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [myPublicKey, setMyPublicKey] = useState<string | null>(null);
  const [peerDeviceCount, setPeerDeviceCount] = useState(0);
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
  const ratchetStoreRef = useRef<RatchetStore | null>(null);
  const conversationDevicesRef = useRef<DeviceKeyInfo[]>([]);
  const decryptedCacheRef = useRef<Map<string, DecryptedPayload>>(new Map());
  const distributedSenderKeysRef = useRef<Set<string>>(new Set());
  const deviceRegisteredRef = useRef(false);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const urls = objectUrlsRef.current;

    return () => {
      mountedRef.current = false;

      for (const url of urls) {
        URL.revokeObjectURL(url);
      }

      urls.clear();
    };
  }, []);

  useEffect(() => {
    const activeUrls = new Set(
      messages
        .map((message) => message.attachmentUrl)
        .filter((url): url is string => Boolean(url)),
    );

    for (const url of objectUrlsRef.current) {
      if (!activeUrls.has(url)) {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(url);
      }
    }
  }, [messages]);

  const conversationId = conversation.id;

  const getRatchetStore = useCallback((): RatchetStore => {
    if (!ratchetStoreRef.current) {
      ratchetStoreRef.current = createIndexedDbRatchetStore();
    }

    return ratchetStoreRef.current;
  }, []);

  const ensureLocalIdentity = useCallback(async () => {
    const [deviceId, identityPair, signedPrekey] = await Promise.all([
      getOrCreateDeviceId(),
      getOrCreateKeyPair(),
      getOrCreateSignedPrekey(),
    ]);
    const publicKey = await exportPublicKey(identityPair);

    setMyPublicKey(publicKey);

    if (!deviceRegisteredRef.current) {
      deviceRegisteredRef.current = true;
      registerCurrentDevice(deviceId, publicKey).catch(() => {
        deviceRegisteredRef.current = false;
      });
    }

    return { deviceId, identityPair, signedPrekey, publicKey };
  }, []);

  const fetchConversationDevices = useCallback(
    async (forceRefresh = false): Promise<DeviceKeyInfo[]> => {
      if (!forceRefresh && conversationDevicesRef.current.length > 0) {
        return conversationDevicesRef.current;
      }

      try {
        const res = await fetch(
          `/api/dm/devices?conversationId=${encodeURIComponent(conversationId)}`,
        );

        if (!res.ok) {
          return conversationDevicesRef.current;
        }

        const data = (await res.json()) as { devices?: DeviceKeyInfo[] };
        const active = (data.devices ?? []).filter((d) => !d.revoked_at);

        conversationDevicesRef.current = active;
        setPeerDeviceCount(active.filter((d) => d.user_id !== myUserId).length);

        return active;
      } catch {
        return conversationDevicesRef.current;
      }
    },
    [conversationId, myUserId],
  );

  const decryptWithPairwiseRatchet = useCallback(
    async (
      senderDeviceId: string,
      isSelfSameDevice: boolean,
      env: V2DeviceEnvelope,
      devices: DeviceKeyInfo[],
    ): Promise<string> => {
      const store = getRatchetStore();
      const {
        deviceId: myDeviceId,
        identityPair,
        signedPrekey,
      } = await ensureLocalIdentity();
      const sessionKey = isSelfSameDevice
        ? `dm-self-recv:${conversationId}:${myDeviceId}`
        : `dm:${conversationId}:${senderDeviceId}`;
      let state = await store.getRatchet(sessionKey);

      if (!state) {
        let remoteIdentityKeyStr: string | null = null;

        if (isSelfSameDevice) {
          remoteIdentityKeyStr = await exportPublicKey(identityPair);
        } else {
          const matched = devices.find((d) => d.device_id === senderDeviceId);

          if (matched) {
            remoteIdentityKeyStr = matched.identity_public_key;
          } else {
            const refreshed = await fetchConversationDevices(true);

            remoteIdentityKeyStr =
              refreshed.find((d) => d.device_id === senderDeviceId)
                ?.identity_public_key ?? null;
          }
        }

        if (!remoteIdentityKeyStr) {
          throw new Error("Missing sender device identity key");
        }

        const remoteIdPub = await importRawPublicKey(remoteIdentityKeyStr);
        const sharedSecret = await deriveResponderSharedSecret(
          identityPair.privateKey,
          signedPrekey.keyPair.privateKey,
          remoteIdPub,
        );

        state = await ratchetInitReceiver(sharedSecret, signedPrekey.keyPair);
      }

      const { state: nextState, plaintext } = await ratchetDecrypt(
        state,
        { dhPub: env.dhPub, n: env.n, pn: env.pn },
        env.iv,
        env.ct,
      );

      await store.setRatchet(sessionKey, nextState);

      return plaintext;
    },
    [
      conversationId,
      ensureLocalIdentity,
      fetchConversationDevices,
      getRatchetStore,
    ],
  );

  const mapWire = useCallback(
    async (wire: WireMessage[], peerPublicKey: string | null) => {
      const supabase = createSupabaseBrowserClient();
      const nameById = new Map(participants.map((p) => [p.userId, p.name]));
      const memberKeys = memberKeysRef.current;
      const group = conversation.isGroup;
      const { deviceId: myDeviceId } = await ensureLocalIdentity();
      const devices = await fetchConversationDevices();
      const store = getRatchetStore();
      let fetchedSenderKeys: SenderKeyRecord[] | null = null;

      return Promise.all(
        wire.map(async (message) => {
          let text = UNDECRYPTABLE;
          let decryptFailed = true;
          let attachmentUrl: string | null = null;
          let encryptedMedia: EncryptedMediaMeta | null = null;

          const v2Env = parseV2Envelope(message.body);
          const v2gEnv = v2Env ? null : parseV2GroupEnvelope(message.body);

          if (v2Env || v2gEnv) {
            const memCached = decryptedCacheRef.current.get(message.id);
            const cached = memCached ?? (await getCachedPayload(message.id));

            if (cached) {
              decryptedCacheRef.current.set(message.id, cached);
              text = cached.text ?? "";
              encryptedMedia = cached.media ?? null;
              decryptFailed = false;

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
                attachmentUrl: null,
                encryptedMedia,
                replyToId: message.reply_to_id ?? null,
                reactions: {},
                edited: Boolean(message.edited_at),
                pinned: Boolean(message.is_pinned),
              } satisfies RenderMessage;
            }
          }

          if (v2Env) {
            try {
              const devEnv = v2Env.envelopes[myDeviceId];

              if (devEnv) {
                const isSelfSameDevice =
                  message.sender_id === myUserId &&
                  devEnv.senderDeviceId === myDeviceId;
                const plaintext = await decryptWithPairwiseRatchet(
                  devEnv.senderDeviceId,
                  isSelfSameDevice,
                  devEnv,
                  devices,
                );
                const payload = parseDecryptedPayload(plaintext);

                decryptedCacheRef.current.set(message.id, payload);
                await setCachedPayload(message.id, payload);
                text = payload.text ?? "";
                encryptedMedia = payload.media ?? null;
                decryptFailed = false;
              }
            } catch {
              text = UNDECRYPTABLE;
              decryptFailed = true;
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
              attachmentUrl: null,
              encryptedMedia,
              replyToId: message.reply_to_id ?? null,
              reactions: {},
              edited: Boolean(message.edited_at),
              pinned: Boolean(message.is_pinned),
            } satisfies RenderMessage;
          }

          if (v2gEnv) {
            try {
              const groupRecvKey = `group-recv:${conversationId}:${v2gEnv.senderDeviceId}:${v2gEnv.keyId}`;
              let senderKeyState = await store.getSenderKey(groupRecvKey);

              if (!senderKeyState) {
                if (fetchedSenderKeys === null) {
                  const skRes = await fetch(
                    `/api/dm/conversations/${conversationId}/sender-keys?deviceId=${encodeURIComponent(myDeviceId)}`,
                  );

                  if (skRes.ok) {
                    const skData = (await skRes.json()) as {
                      senderKeys?: SenderKeyRecord[];
                    };

                    fetchedSenderKeys = skData.senderKeys ?? [];
                  } else {
                    fetchedSenderKeys = [];
                  }
                }

                const match = fetchedSenderKeys.find(
                  (sk) =>
                    sk.owner_device_id === v2gEnv.senderDeviceId &&
                    sk.key_id === v2gEnv.keyId,
                );

                if (match) {
                  const wrappedEnv = JSON.parse(
                    match.encrypted_sender_key,
                  ) as V2DeviceEnvelope;
                  const unwrappedJson = await decryptWithPairwiseRatchet(
                    wrappedEnv.senderDeviceId,
                    false,
                    wrappedEnv,
                    devices,
                  );
                  const parsedKey = JSON.parse(unwrappedJson) as {
                    keyId: string;
                    chainKeyB64: string;
                  };

                  senderKeyState = createSenderKeyState(
                    v2gEnv.senderDeviceId,
                    parsedKey.keyId,
                    parsedKey.chainKeyB64,
                  );
                }
              }

              if (senderKeyState) {
                const { state: nextSk, plaintext } = await decryptGroupMessage(
                  senderKeyState,
                  v2gEnv,
                );

                await store.setSenderKey(groupRecvKey, nextSk);
                const payload = parseDecryptedPayload(plaintext);

                decryptedCacheRef.current.set(message.id, payload);
                await setCachedPayload(message.id, payload);
                text = payload.text ?? "";
                encryptedMedia = payload.media ?? null;
                decryptFailed = false;
              }
            } catch {
              text = UNDECRYPTABLE;
              decryptFailed = true;
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
              attachmentUrl: null,
              encryptedMedia,
              replyToId: message.reply_to_id ?? null,
              reactions: {},
              edited: Boolean(message.edited_at),
              pinned: Boolean(message.is_pinned),
            } satisfies RenderMessage;
          }

          // Replay guard for v1 messages: the same wire twice in one
          // conversation is a resend/replay, not a new message.
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
                  const safeMime = sanitizePeerMediaMimeType(
                    message.attachment_mime,
                  );
                  const createdUrl = URL.createObjectURL(
                    new Blob([plain], {
                      type: safeMime,
                    }),
                  );

                  if (mountedRef.current) {
                    objectUrlsRef.current.add(createdUrl);
                    attachmentUrl = createdUrl;
                  } else {
                    URL.revokeObjectURL(createdUrl);
                  }
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
    [
      participants,
      conversationId,
      conversation.isGroup,
      myUserId,
      ensureLocalIdentity,
      fetchConversationDevices,
      getRatchetStore,
      decryptWithPairwiseRatchet,
    ],
  );

  const loadPage = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (before) params.set("before", before);
      const [response] = await Promise.all([
        fetch(`/api/dm/conversations/${conversationId}/messages?${params}`),
        fetchConversationDevices(true),
      ]);
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
    [conversationId, fetchConversationDevices, mapWire],
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
    return () => {
      unsubscribe();
      if (typingTimer.current) {
        window.clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
    };
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

  const encryptPairwiseDevice = useCallback(
    async (
      target: DeviceKeyInfo,
      plaintext: string,
      myDeviceId: string,
      identityPair: CryptoKeyPair,
    ): Promise<V2DeviceEnvelope> => {
      const store = getRatchetStore();
      const sessionKey = `dm:${conversationId}:${target.device_id}`;
      let state = await store.getRatchet(sessionKey);

      if (!state) {
        const [remoteIdPub, remoteSpkPub] = await Promise.all([
          importRawPublicKey(target.identity_public_key),
          importRawPublicKey(target.signed_prekey_public),
        ]);
        const sharedSecret = await deriveInitialSharedSecret(
          identityPair.privateKey,
          remoteIdPub,
          remoteSpkPub,
        );

        state = await ratchetInitSender(
          sharedSecret,
          target.signed_prekey_public,
        );
      }

      const {
        state: nextState,
        header,
        iv,
        ct,
      } = await ratchetEncrypt(state, plaintext);

      await store.setRatchet(sessionKey, nextState);

      return {
        senderDeviceId: myDeviceId,
        dhPub: header.dhPub,
        n: header.n,
        pn: header.pn,
        iv,
        ct,
      };
    },
    [conversationId, getRatchetStore],
  );

  const encryptForConversation = useCallback(
    async (
      payload: DecryptedPayload,
    ): Promise<{
      ciphertext: string;
      groupWraps?: Record<string, { iv: string; cipher: string }>;
    }> => {
      const group = conversation.isGroup;
      const peerPublicKey = peerPublicKeyRef.current;
      const memberKeys = memberKeysRef.current;
      const {
        deviceId: myDeviceId,
        identityPair,
        signedPrekey,
      } = await ensureLocalIdentity();
      const devices = await fetchConversationDevices(true);
      const otherDevices = devices.filter((d) => d.device_id !== myDeviceId);
      const hasPeerDevices = devices.some((d) => d.user_id !== myUserId);
      const serializedPayload = JSON.stringify(payload);
      const store = getRatchetStore();

      if (group && otherDevices.length > 0) {
        const groupSendKey = `group-send:${conversationId}:${myDeviceId}`;
        let senderState = await store.getSenderKey(groupSendKey);

        if (!senderState) {
          senderState = createSenderKeyState(myDeviceId);
          await store.setSenderKey(
            `group-recv:${conversationId}:${myDeviceId}:${senderState.keyId}`,
            senderState,
          );
        }

        const missingDevices = otherDevices.filter(
          (d) =>
            !distributedSenderKeysRef.current.has(
              `${senderState.keyId}:${d.device_id}`,
            ),
        );

        if (missingDevices.length > 0) {
          const keyDistributionPayload = JSON.stringify({
            keyId: senderState.keyId,
            chainKeyB64: senderState.chainKeyB64,
          });
          const envelopes = await Promise.all(
            missingDevices.map(async (target) => {
              const env = await encryptPairwiseDevice(
                target,
                keyDistributionPayload,
                myDeviceId,
                identityPair,
              );

              return {
                ownerDeviceId: myDeviceId,
                recipientUserId: target.user_id,
                recipientDeviceId: target.device_id,
                keyId: senderState.keyId,
                encryptedSenderKey: JSON.stringify(env),
              };
            }),
          );
          const distRes = await fetch(
            `/api/dm/conversations/${conversationId}/sender-keys`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ envelopes }),
            },
          );

          if (!distRes.ok) {
            throw new Error("Could not distribute group sender key");
          }

          for (const target of missingDevices) {
            distributedSenderKeysRef.current.add(
              `${senderState.keyId}:${target.device_id}`,
            );
          }
        }

        const { state: nextSenderState, envelope } = await encryptGroupMessage(
          senderState,
          serializedPayload,
        );

        await store.setSenderKey(groupSendKey, nextSenderState);

        return { ciphertext: serializeV2GroupEnvelope(envelope) };
      }

      if (!group && hasPeerDevices) {
        const envelopes: Record<string, V2DeviceEnvelope> = {};

        for (const target of otherDevices) {
          envelopes[target.device_id] = await encryptPairwiseDevice(
            target,
            serializedPayload,
            myDeviceId,
            identityPair,
          );
        }

        // Also encrypt a self-envelope so this device can decrypt its own
        // sent message on subsequent page reloads.
        const selfSendKey = `dm-self-send:${conversationId}:${myDeviceId}`;
        let selfSendState = await store.getRatchet(selfSendKey);

        if (!selfSendState) {
          const selfSecret = await deriveInitialSharedSecret(
            identityPair.privateKey,
            identityPair.publicKey,
            signedPrekey.keyPair.publicKey,
          );

          selfSendState = await ratchetInitSender(
            selfSecret,
            signedPrekey.publicKey,
          );
        }

        const {
          state: nextSelfState,
          header,
          iv,
          ct,
        } = await ratchetEncrypt(selfSendState, serializedPayload);

        await store.setRatchet(selfSendKey, nextSelfState);
        envelopes[myDeviceId] = {
          senderDeviceId: myDeviceId,
          dhPub: header.dhPub,
          n: header.n,
          pn: header.pn,
          iv,
          ct,
        };

        return { ciphertext: serializeV2Envelope({ v: 2, envelopes }) };
      }

      // v1 fallback when peer devices have not registered for v2 yet.
      if (group) {
        const dataKey = await generateDataKey();
        const selfPair = await getOrCreateKeyPair();
        const aad = buildAad(conversationId, myUserId);
        const ciphertext = await encryptWithDataKey(
          dataKey,
          payload.text ?? "",
          aad,
        );
        const wrapped = await Promise.all(
          Object.entries(memberKeys).map(async ([memberId, memberKey]) => [
            memberId,
            await wrapDataKey(selfPair, memberKey, dataKey),
          ]),
        );

        return { ciphertext, groupWraps: Object.fromEntries(wrapped) };
      }

      if (!peerPublicKey) {
        throw new Error(
          "Waiting for the other person to sign in. Their encryption key is not published yet.",
        );
      }

      const ciphertext = await encryptMessage(
        peerPublicKey,
        payload.text ?? "",
        {
          conversationId,
          senderId: myUserId,
        },
      );

      return { ciphertext };
    },
    [
      conversation.isGroup,
      conversationId,
      encryptPairwiseDevice,
      ensureLocalIdentity,
      fetchConversationDevices,
      getRatchetStore,
      myUserId,
    ],
  );

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text) return;
    const peerPublicKey = peerPublicKeyRef.current;
    const group = conversation.isGroup;
    const memberKeys = memberKeysRef.current;
    const devices = await fetchConversationDevices();
    const hasPeerDevices = devices.some((d) => d.user_id !== myUserId);
    if (!peerPublicKey && !hasPeerDevices) {
      setError(
        "Waiting for the other person to sign in. Their encryption key is not published yet.",
      );
      return;
    }
    if (group && Object.keys(memberKeys).length === 0 && !hasPeerDevices) {
      setError(
        "Waiting for group members to sign in. Their encryption keys are not published yet.",
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
      const payload: DecryptedPayload = { text };
      const { ciphertext, groupWraps } = await encryptForConversation(payload);

      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciphertext, groupWraps }),
        },
      );
      if (!response.ok) throw new Error("Could not send message");
      const created = (await response.json().catch(() => null)) as {
        id?: string;
      } | null;

      if (created?.id) {
        decryptedCacheRef.current.set(created.id, payload);
        await setCachedPayload(created.id, payload);
      }

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
    try {
      const payload: DecryptedPayload = {
        text: message.text,
        ...(message.encryptedMedia ? { media: message.encryptedMedia } : {}),
      };
      const { ciphertext, groupWraps } = await encryptForConversation(payload);
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciphertext, groupWraps }),
        },
      );
      if (!response.ok) throw new Error("Retry failed");
      const created = (await response.json().catch(() => null)) as {
        id?: string;
      } | null;

      if (created?.id) {
        decryptedCacheRef.current.set(created.id, payload);
        await setCachedPayload(created.id, payload);
      }

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
    setError(null);
    setEmojiFor(null);
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

    try {
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages/${messageId}/react`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      );

      if (!response.ok) {
        throw new Error("Could not update reaction");
      }
    } catch {
      setMessages((current) =>
        current.map((m) => {
          if (m.id !== messageId) return m;
          const nextCount = (m.reactions[emoji] ?? 0) - 1;
          const nextReactions = { ...m.reactions };
          if (nextCount <= 0) {
            delete nextReactions[emoji];
          } else {
            nextReactions[emoji] = nextCount;
          }
          return { ...m, reactions: nextReactions };
        }),
      );
      setError("Could not update reaction");
    }
  }

  async function saveEdit(): Promise<void> {
    if (!editing || !editText.trim()) return;
    try {
      const nextText = editText.trim();
      const payload: DecryptedPayload = { text: nextText };
      const { ciphertext, groupWraps } = await encryptForConversation(payload);
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciphertext, groupWraps }),
        },
      );
      if (!response.ok) throw new Error("Edit failed");
      decryptedCacheRef.current.set(editing.id, payload);
      await setCachedPayload(editing.id, payload);
      setMessages((current) =>
        current.map((m) =>
          m.id === editing.id ? { ...m, text: nextText, edited: true } : m,
        ),
      );
      setEditing(null);
    } catch {
      setError("Could not edit message");
    }
  }

  async function remove(messageId: string): Promise<void> {
    try {
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages/${messageId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        setError("Could not delete message");
        return;
      }

      setMessages((current) => current.filter((m) => m.id !== messageId));
    } catch {
      setError("Could not delete message");
    }
  }

  async function copyMessage(message: RenderMessage): Promise<void> {
    try {
      await navigator.clipboard.writeText(message.text);
      setError(null);
      setNotice("Copied to clipboard");
      window.setTimeout(() => setNotice(null), 2000);
    } catch {
      setNotice(null);
      setError("Could not copy message");
    }
  }

  async function togglePin(message: RenderMessage): Promise<void> {
    const previousPinned = Boolean(message.pinned);
    const pinned = !previousPinned;
    setError(null);
    setMessages((current) =>
      current.map((m) => (m.id === message.id ? { ...m, pinned } : m)),
    );

    try {
      const response = await fetch(
        `/api/dm/conversations/${conversationId}/messages/${message.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned }),
        },
      );

      if (!response.ok) {
        throw new Error("Could not update pin state");
      }
    } catch {
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id ? { ...m, pinned: previousPinned } : m,
        ),
      );
      setError("Could not update pin state");
    }
  }

  async function sendFile(file: File): Promise<void> {
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
    try {
      const supabase = createSupabaseBrowserClient();
      const buf = await file.arrayBuffer();
      const devices = await fetchConversationDevices();
      const hasV2Targets = devices.some(
        (d) => conversation.isGroup || d.user_id !== myUserId,
      );

      if (hasV2Targets) {
        const { encryptedBytes, keyB64, ivB64, sha256B64 } =
          await encryptMediaBytes(new Uint8Array(buf));
        const path = `${conversationId}/${crypto.randomUUID()}.enc`;
        const { error: uploadError } = await supabase.storage
          .from("dm-media")
          .upload(
            path,
            new Blob([encryptedBytes], { type: "application/octet-stream" }),
            { contentType: "application/octet-stream" },
          );
        if (uploadError) {
          setError("Upload failed");
          return;
        }

        const payload: DecryptedPayload = {
          media: {
            storagePath: path,
            mimeType: file.type || "application/octet-stream",
            fileName: file.name,
            fileSize: file.size,
            keyB64,
            ivB64,
            sha256B64,
          },
        };
        const { ciphertext, groupWraps } =
          await encryptForConversation(payload);
        const response = await fetch(
          `/api/dm/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ciphertext, groupWraps }),
          },
        );

        if (!response.ok) {
          setError("Could not send file");
          return;
        }

        const created = (await response.json().catch(() => null)) as {
          id?: string;
        } | null;

        if (created?.id) {
          decryptedCacheRef.current.set(created.id, payload);
          await setCachedPayload(created.id, payload);
        }

        router.refresh();
        return;
      }

      const peerPublicKey = peerPublicKeyRef.current;
      if (!peerPublicKey) {
        setError(
          "Waiting for the other person to sign in. Their encryption key is not published yet.",
        );
        return;
      }
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

      if (!response.ok) {
        setError("Could not send file");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not send file");
    }
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
          <span className="bg-accent-soft text-accent flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold">
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
            aria-label="Verify end-to-end encryption safety number"
            onClick={() => setSafetyOpen(true)}
            className="border-border bg-accent-soft/60 text-accent hover:bg-accent-soft hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:inline-flex"
          >
            <ShieldCheck
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            <span>E2EE</span>
          </button>
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
              <span className="bg-surface border-border absolute top-full right-0 z-20 mt-2 flex w-64 flex-col gap-2 rounded-xl border p-3 text-xs leading-relaxed shadow-lg">
                <span className="flex items-start gap-2">
                  <Lock
                    aria-hidden="true"
                    className="text-accent mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    Your messages are protected with end-to-end encryption. Only
                    you and the people you chat with can read them.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInfoOpen(false);
                    setSafetyOpen(true);
                  }}
                  className="text-accent hover:bg-accent-soft flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <ShieldCheck
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Verify safety number
                </button>
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
                          <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
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
                            <div
                              className={
                                mine
                                  ? "block rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-left text-sm whitespace-pre-wrap text-accent-foreground"
                                  : "block rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-left text-sm whitespace-pre-wrap text-foreground"
                              }
                            >
                              {editing?.id === message.id ? (
                                <div className="block">
                                  <textarea
                                    value={editText}
                                    onChange={(event) =>
                                      setEditText(event.target.value)
                                    }
                                    aria-label="Edit message"
                                    rows={2}
                                    className="w-full rounded bg-transparent text-inherit focus-visible:outline-2"
                                  />
                                  <div className="mt-1.5 flex gap-3">
                                    <button
                                      type="button"
                                      onClick={() => void saveEdit()}
                                      className="cursor-pointer rounded-sm text-xs font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditing(null)}
                                      className="cursor-pointer rounded-sm text-xs underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : message.decryptFailed ? (
                                <span className="flex items-center gap-1.5 italic opacity-75">
                                  <Lock
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5 shrink-0"
                                  />
                                  <span>{message.text}</span>
                                </span>
                              ) : (
                                message.text
                              )}
                              {message.encryptedMedia ? (
                                <EncryptedMediaAttachment
                                  media={message.encryptedMedia}
                                  isMine={mine}
                                />
                              ) : null}
                              {message.attachmentUrl ? (
                                (() => {
                                  const safeAttachmentMime =
                                    sanitizePeerMediaMimeType(
                                      message.attachmentMime,
                                    );

                                  if (safeAttachmentMime.startsWith("image/")) {
                                    return (
                                      // eslint-disable-next-line @next/next/no-img-element -- attachment previews use signed/blob URLs that next/image cannot optimize
                                      <img
                                        src={message.attachmentUrl}
                                        alt={
                                          message.attachmentName ?? "attachment"
                                        }
                                        className="mt-2 max-h-64 rounded-lg"
                                      />
                                    );
                                  }

                                  if (safeAttachmentMime.startsWith("video/")) {
                                    return (
                                      <video
                                        src={message.attachmentUrl}
                                        controls
                                        className="mt-2 max-h-64 rounded-lg"
                                      />
                                    );
                                  }

                                  if (safeAttachmentMime.startsWith("audio/")) {
                                    return (
                                      <audio
                                        src={message.attachmentUrl}
                                        controls
                                        className="mt-2 w-full max-w-56"
                                      />
                                    );
                                  }

                                  return (
                                    <a
                                      href={message.attachmentUrl}
                                      download={
                                        message.attachmentName ?? "file"
                                      }
                                      className="mt-2 block rounded-sm text-xs underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                                    >
                                      {message.attachmentName ??
                                        "Download file"}
                                    </a>
                                  );
                                })()
                              ) : message.attachmentName ? (
                                <span className="mt-1 block text-xs opacity-70">
                                  {message.attachmentName} (decrypt failed)
                                </span>
                              ) : null}
                            </div>
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
                                    className="text-danger cursor-pointer rounded-sm text-[10px] font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
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
                                    className="text-danger text-[11px] underline underline-offset-2"
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
          className="text-danger px-4 pt-2 text-sm sm:px-6"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          className="text-muted-foreground px-4 pt-2 text-sm sm:px-6"
          role="status"
        >
          {notice}
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
      <SafetyNumberDialog
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        peerName={displayName}
        myPublicKey={myPublicKey}
        peerPublicKey={peerPublicKey}
        peerDeviceCount={peerDeviceCount}
      />
    </div>
  );
}
