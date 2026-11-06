import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { deleteMessage, editMessage, setMessagePinned } from "@/lib/db/dm-v2";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; messageId: string }> };

function toError(error: unknown) {
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
  if (code === "22023") {
    return NextResponse.json(
      { error: "Message must be encrypted" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: "Could not update message" },
    { status: 500 },
  );
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await enforceRateLimit({
      action: "dm:messages:edit",
      identifier: getClientIdentifier(request),
      limit: 60,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id, messageId } = await params;
    const body = await request.json();

    if (typeof body?.pinned === "boolean") {
      await setMessagePinned(messageId, id, body.pinned);
      return NextResponse.json({ ok: true });
    }

    const ciphertext = body?.ciphertext;
    if (typeof ciphertext !== "string" || !ciphertext) {
      return NextResponse.json(
        { error: "Missing ciphertext" },
        { status: 400 },
      );
    }

    await editMessage(messageId, id, ciphertext);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, messageId } = await params;
    await deleteMessage(messageId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toError(error);
  }
}
