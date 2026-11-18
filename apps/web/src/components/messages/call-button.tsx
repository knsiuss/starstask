"use client";

import { Phone, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Voice/video call signaling (WebRTC SDP in dm_calls.signal).
 * Media is DTLS-E2EE by WebRTC itself. v1: signaling only, media via browser RTCPeerConnection.
 * Full call UI (ringing, accept, hangup) — simplified: start call creates row, peer polls.
 */
export function CallButton({ conversationId }: { conversationId: string }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [localStream]);

  async function startCall(kind: "audio" | "video") {
    setError(null);
    let stream: MediaStream | null = null;
    let pc: RTCPeerConnection | null = null;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      if (!me) {
        setError("Sign in to start a call.");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Media devices are not available in this browser.");
        return;
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video",
      });
      setLocalStream(stream);

      pc = new RTCPeerConnection();
      stream.getTracks().forEach((track) => pc?.addTrack(track, stream!));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const { error: insertError } = await supabase.from("dm_calls").insert({
        conversation_id: conversationId,
        caller_id: me,
        kind,
        signal: JSON.stringify(pc.localDescription),
      });

      if (insertError) {
        throw new Error("Could not start call.");
      }

      setStatus("ringing...");
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        stream?.getTracks().forEach((track) => track.stop());
        pc?.close();
        setLocalStream(null);
        setStatus("idle");
      }, 30000);
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      pc?.close();
      setLocalStream(null);
      setStatus("idle");
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not start call.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Start audio call"
          className="rounded border px-2 py-1 text-xs"
          onClick={() => void startCall("audio")}
        >
          <Phone
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </button>
        <button
          type="button"
          aria-label="Start video call"
          className="rounded border px-2 py-1 text-xs"
          onClick={() => void startCall("video")}
        >
          <Video
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </button>
        {status !== "idle" ? <span className="text-xs">{status}</span> : null}
        {localStream ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-10 w-10 rounded object-cover"
          />
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="text-danger text-xs"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
