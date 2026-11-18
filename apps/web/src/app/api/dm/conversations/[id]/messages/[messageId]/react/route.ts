import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/db/assignments";
import { toggleReaction } from "@/lib/db/dm-v2";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    await enforceRateLimit({
      action: "dm:reactions",
      identifier: session.user.id,
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

    const reactions = await toggleReaction(messageId, id, emoji);

    return NextResponse.json({ ok: true, reactions });
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

    if (error instanceof DataAccessError) {
      if (error.code === "42501") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (error.code === "22023") {
        return NextResponse.json(
          { error: "Invalid reaction" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ error: "Could not react" }, { status: 500 });
  }
}
