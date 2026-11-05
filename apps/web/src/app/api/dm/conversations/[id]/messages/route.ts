import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import {
  getConversationParticipants,
  getConversationPeerId,
  getPeerPublicKey,
  listMessages,
  sendCiphertext,
} from "@/lib/db/direct-messages";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    await enforceRateLimit({
      action: "dm:messages:list",
      identifier: getClientIdentifier(request),
      limit: 120,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id } = await params;
    const url = new URL(request.url);
    const before = url.searchParams.get("before") ?? undefined;
    const limitParam = Number(url.searchParams.get("limit") ?? 50);
    const peerId = await getConversationPeerId(id);
    const [messages, peerPublicKey, participants] = await Promise.all([
      listMessages(id, { before, limit: limitParam }),
      getPeerPublicKey(peerId),
      getConversationParticipants(id),
    ]);

    return NextResponse.json({
      messages,
      peerPublicKey,
      peerId,
      participants,
      hasMore:
        messages.length >= (Number.isFinite(limitParam) ? limitParam : 50),
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
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
    await enforceRateLimit({
      action: "dm:messages:send",
      identifier: getClientIdentifier(request),
      limit: 60,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id } = await params;
    const body = await request.json();
    const ciphertext = body?.ciphertext;

    if (typeof ciphertext !== "string" || !ciphertext) {
      return NextResponse.json(
        { error: "Missing ciphertext" },
        { status: 400 },
      );
    }

    const attachment = body?.attachment as
      { name: string; mime: string; size: number; path: string } | undefined;
    const message = await sendCiphertext(id, ciphertext, attachment);

    return NextResponse.json(message, { status: 201 });
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
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    if (code === "42901") {
      return NextResponse.json(
        { error: "Too many messages, slow down" },
        { status: 429 },
      );
    }

    if (code === "22023" || code === "42501") {
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
