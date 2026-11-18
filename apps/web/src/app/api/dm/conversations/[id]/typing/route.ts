import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/db/assignments";
import { getTyping, setTyping } from "@/lib/db/dm-v2";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

async function limit(userId: string, action: string) {
  await enforceRateLimit({
    action,
    identifier: userId,
    limit: 120,
    windowSeconds: 60,
    onBackendFailure: "closed",
  });
}

function errorResponse(error: unknown, fallbackMessage: string): NextResponse {
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

  if (error instanceof DataAccessError && error.code === "42501") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    await limit(session.user.id, "dm:typing:get");
    const { id } = await params;

    return NextResponse.json({ typing: await getTyping(id) });
  } catch (error) {
    return errorResponse(error, "Could not load typing");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    await limit(session.user.id, "dm:typing:set");
    const { id } = await params;
    const body = await req.json();

    await setTyping(id, Boolean(body?.isTyping ?? body?.is_typing));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Could not save typing");
  }
}
