import { NextResponse } from "next/server";

import {
  getConversationPeerId,
  getPeerPublicKey,
  listMessages,
  sendCiphertext,
} from "@/lib/db/direct-messages";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const peerId = await getConversationPeerId(id);
    const [messages, peerPublicKey] = await Promise.all([
      listMessages(id),
      getPeerPublicKey(peerId),
    ]);

    return NextResponse.json({
      messages,
      peerPublicKey,
      peerId,
    });
  } catch (error) {
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
