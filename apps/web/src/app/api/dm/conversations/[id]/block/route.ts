import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/db/assignments";
import {
  blockUser,
  resolveBlockTargetInConversation,
} from "@/lib/db/direct-messages";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const blockBodySchema = z.object({
  userId: z.string().uuid().optional(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    await enforceRateLimit({
      action: "dm:block",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id } = await params;
    let requestedUserId: string | undefined;

    const rawText = await request.text().catch(() => "");

    if (rawText.trim().length > 0) {
      const parsedJson = JSON.parse(rawText) as unknown;
      const parsedBody = blockBodySchema.safeParse(parsedJson);

      if (!parsedBody.success) {
        return NextResponse.json(
          { error: "Invalid request body" },
          { status: 400 },
        );
      }

      requestedUserId = parsedBody.data.userId;
    }

    const peerId = await resolveBlockTargetInConversation(id, requestedUserId);

    await blockUser(peerId);

    return NextResponse.json({ ok: true });
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
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Could not block" }, { status: 500 });
  }
}
