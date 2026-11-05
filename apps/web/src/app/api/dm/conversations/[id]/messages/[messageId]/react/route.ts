import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { toggleReaction } from "@/lib/db/dm-v2";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    await enforceRateLimit({
      action: "dm:reactions",
      identifier: getClientIdentifier(req),
      limit: 120,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id, messageId } = await params;
    const body = await req.json();
    const emoji = String(body?.emoji ?? "").slice(0, 8);
    if (!emoji) {
      return NextResponse.json({ error: "emoji required" }, { status: 400 });
    }

    await toggleReaction(messageId, id, emoji);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Could not react" }, { status: 500 });
  }
}
