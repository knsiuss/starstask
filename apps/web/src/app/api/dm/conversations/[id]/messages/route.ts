import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import {
  getConversationMemberKeys,
  getConversationParticipants,
  getConversationPeerId,
  getPeerPublicKey,
  listMessages,
  sendCiphertext,
} from "@/lib/db/direct-messages";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    await enforceRateLimit({
      action: "dm:messages:list",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id } = await params;
    const url = new URL(request.url);
    const before = url.searchParams.get("before") ?? undefined;
    const limitQuery = url.searchParams.get("limit");
    const rawLimit =
      limitQuery !== null && limitQuery.trim() !== "" ? Number(limitQuery) : 50;
    const effectiveLimit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 50, 1),
      100,
    );
    const peerId = await getConversationPeerId(id);
    const [messages, peerPublicKey, participants, memberKeys] =
      await Promise.all([
        listMessages(id, { before, limit: effectiveLimit }),
        peerId ? getPeerPublicKey(peerId) : Promise.resolve(null),
        getConversationParticipants(id),
        getConversationMemberKeys(id),
      ]);

    return NextResponse.json({
      messages,
      peerPublicKey,
      peerId,
      participants,
      memberKeys,
      hasMore: messages.length >= effectiveLimit,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    const code =
      error instanceof Error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "50000";

    if (code === "42501") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Could not load messages" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    await enforceRateLimit({
      action: "dm:messages:send",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id } = await params;
    const body = await request.json();
    const ciphertext = body?.ciphertext;
    const groupWraps = body?.groupWraps as
      Record<string, { iv: string; cipher: string }> | undefined;

    if (typeof ciphertext !== "string" || !ciphertext) {
      return NextResponse.json(
        { error: "Missing ciphertext" },
        { status: 400 },
      );
    }

    const attachment = body?.attachment as
      { name: string; mime: string; size: number; path: string } | undefined;

    // Client-supplied attachment metadata is untrusted: the object must live
    // under this conversation's folder, the MIME must be a safe media type, and
    // the size must stay inside the client-side cap.
    if (attachment !== undefined) {
      const pathValid =
        typeof attachment.path === "string" &&
        attachment.path.startsWith(`${id}/`) &&
        !attachment.path.includes("..");
      const normalizedMime =
        typeof attachment.mime === "string"
          ? (attachment.mime.trim().toLowerCase().split(";")[0]?.trim() ?? "")
          : "";
      const forbiddenMime =
        normalizedMime === "text/html" || normalizedMime === "image/svg+xml";
      const mimeValid =
        !forbiddenMime &&
        (normalizedMime.startsWith("image/") ||
          normalizedMime.startsWith("video/") ||
          normalizedMime.startsWith("audio/") ||
          normalizedMime === "application/pdf" ||
          normalizedMime.startsWith("text/") ||
          normalizedMime === "application/zip");
      const sizeValid =
        Number.isFinite(attachment.size) &&
        attachment.size > 0 &&
        attachment.size <= 25 * 1024 * 1024;

      if (!pathValid || !mimeValid || !sizeValid) {
        return NextResponse.json(
          { error: "Invalid attachment metadata" },
          { status: 400 },
        );
      }
    }

    const message = await sendCiphertext(
      id,
      ciphertext,
      attachment,
      groupWraps,
    );

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const code =
      error instanceof Error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "50000";

    if (code === "42501") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (code === "42901") {
      return NextResponse.json(
        { error: "Too many messages, slow down" },
        { status: 429 },
      );
    }

    if (code === "22023") {
      return NextResponse.json(
        { error: "Could not send message" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not send message" },
      { status: 500 },
    );
  }
}
