import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { markConversationUnread, setConversationPrefs } from "@/lib/db/dm-v2";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await enforceRateLimit({
      action: "dm:conversations:prefs",
      identifier: getClientIdentifier(request),
      limit: 120,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id } = await params;
    const body = await request.json();

    if (body?.unread === true) {
      await markConversationUnread(id);
      return NextResponse.json({ ok: true });
    }

    const prefs: { pinned?: boolean; muted?: boolean; archived?: boolean } = {};
    if (typeof body?.pinned === "boolean") prefs.pinned = body.pinned;
    if (typeof body?.muted === "boolean") prefs.muted = body.muted;
    if (typeof body?.archived === "boolean") prefs.archived = body.archived;

    if (Object.keys(prefs).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await setConversationPrefs(id, prefs);
    return NextResponse.json({ ok: true });
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
    return NextResponse.json(
      { error: "Could not update conversation" },
      { status: 500 },
    );
  }
}
