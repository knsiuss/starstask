"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Voice/video call signaling (WebRTC SDP in dm_calls.signal).
 * Media is DTLS-E2EE by WebRTC itself. v1: signaling only, media via browser RTCPeerConnection.
 * Full call UI (ringing, accept, hangup) — simplified: start call creates row, peer polls.
 */
export function CallButton({ conversationId }: { conversationId: string }) {
  const [status, setStatus] = useState("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  async function startCall(kind: "audio" | "video") {
    const supabase = createSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === "video",
    });
    setLocalStream(stream);
    const pc = new RTCPeerConnection();
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await supabase.from("dm_calls" as any).insert({
      conversation_id: conversationId,
      caller_id: me,
      kind,
      signal: JSON.stringify(pc.localDescription),
    });
    setStatus("ringing…");
    setTimeout(() => {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("idle");
    }, 30000);
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        className="rounded border px-2 py-1 text-xs"
        onClick={() => void startCall("audio")}
      >
        📞
      </button>
      <button
        type="button"
        className="rounded border px-2 py-1 text-xs"
        onClick={() => void startCall("video")}
      >
        📹
      </button>
      {status !== "idle" ? <span className="text-xs">{status}</span> : null}
      {localStream ? (
        <video
          autoPlay
          muted
          className="h-10 w-10 rounded"
        />
      ) : null}
    </div>
  );
}
