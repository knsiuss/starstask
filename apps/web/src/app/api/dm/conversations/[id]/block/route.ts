import { NextResponse } from "next/server";

import { blockUser, getConversationPeerId } from "@/lib/db/direct-messages";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const peerId = await getConversationPeerId(id);

    await blockUser(peerId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "50000";

    if (code === "42501") {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    return NextResponse.json({ error: "Could not block" }, { status: 500 });
  }
}
