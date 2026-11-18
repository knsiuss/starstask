"use client";

import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { decryptMediaBytes } from "@/lib/crypto/e2ee-media";
import type { EncryptedMediaMeta } from "@/lib/crypto/e2ee-v2";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  media: EncryptedMediaMeta;
  isMine?: boolean;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EncryptedMediaAttachment({ media, isMine = false }: Props) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadAndDecrypt = useCallback(async () => {
    setState({ status: "loading" });

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.storage
        .from("dm-media")
        .download(media.storagePath);

      if (error || !data) {
        throw new Error("Could not download encrypted attachment");
      }

      const encryptedBuf = await data.arrayBuffer();
      const plainBytes = await decryptMediaBytes(
        new Uint8Array(encryptedBuf),
        media.keyB64,
        media.ivB64,
        media.sha256B64,
      );
      const blob = new Blob([plainBytes], {
        type: media.mimeType || "application/octet-stream",
      });
      const objectUrl = URL.createObjectURL(blob);

      setState({ status: "ready", url: objectUrl });
    } catch {
      setState({
        status: "error",
        message: "Could not decrypt attachment on this device",
      });
    }
  }, [
    media.ivB64,
    media.keyB64,
    media.mimeType,
    media.sha256B64,
    media.storagePath,
  ]);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    (async () => {
      setState({ status: "loading" });

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.storage
          .from("dm-media")
          .download(media.storagePath);

        if (error || !data) {
          throw new Error("Could not download encrypted attachment");
        }

        const encryptedBuf = await data.arrayBuffer();
        const plainBytes = await decryptMediaBytes(
          new Uint8Array(encryptedBuf),
          media.keyB64,
          media.ivB64,
          media.sha256B64,
        );
        const blob = new Blob([plainBytes], {
          type: media.mimeType || "application/octet-stream",
        });
        const objectUrl = URL.createObjectURL(blob);

        if (!active) {
          URL.revokeObjectURL(objectUrl);

          return;
        }

        createdUrl = objectUrl;
        setState({ status: "ready", url: objectUrl });
      } catch {
        if (active) {
          setState({
            status: "error",
            message: "Could not decrypt attachment on this device",
          });
        }
      }
    })();

    return () => {
      active = false;

      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [
    media.ivB64,
    media.keyB64,
    media.mimeType,
    media.sha256B64,
    media.storagePath,
  ]);

  useEffect(() => {
    const url = state.status === "ready" ? state.url : null;

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [state]);

  if (state.status === "loading") {
    return (
      <div
        className="mt-2 flex items-center gap-2 rounded-lg border border-current/15 px-3 py-2 text-xs opacity-80"
        role="status"
        aria-label={`Decrypting ${media.fileName}`}
      >
        <Loader2
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin"
        />
        <span className="truncate">Decrypting {media.fileName}...</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-current/20 px-3 py-2 text-xs">
        <span className="opacity-85">{state.message}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void loadAndDecrypt();
          }}
          aria-label={`Retry decrypting ${media.fileName}`}
          className="inline-flex shrink-0 items-center gap-1 font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <RefreshCw
            aria-hidden="true"
            className="h-3 w-3"
          />
          Retry
        </button>
      </div>
    );
  }

  if (media.mimeType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- decrypted attachment uses a local blob URL that next/image cannot optimize
      <img
        src={state.url}
        alt={media.fileName}
        className="mt-2 max-h-64 rounded-lg object-contain"
      />
    );
  }

  if (media.mimeType.startsWith("video/")) {
    return (
      <video
        src={state.url}
        controls
        aria-label={media.fileName}
        className="mt-2 max-h-64 rounded-lg"
      />
    );
  }

  if (media.mimeType.startsWith("audio/")) {
    return (
      <audio
        src={state.url}
        controls
        aria-label={`Voice or audio attachment: ${media.fileName}`}
        className="mt-2 w-full max-w-56"
      />
    );
  }

  return (
    <a
      href={state.url}
      download={media.fileName}
      onClick={(event) => event.stopPropagation()}
      className={
        isMine
          ? "mt-2 flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2"
          : "border-border bg-surface text-foreground hover:bg-muted mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      }
    >
      <FileText
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
      />
      <span className="min-w-0 flex-1 truncate font-medium">
        {media.fileName}
      </span>
      <span className="shrink-0 opacity-75">
        {formatFileSize(media.fileSize)}
      </span>
      <Download
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0"
      />
    </a>
  );
}
