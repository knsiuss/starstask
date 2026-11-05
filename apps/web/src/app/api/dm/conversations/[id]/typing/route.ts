import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { getTyping, setTyping } from "@/lib/db/dm-v2";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

async function limit(request: Request, action: string) {
  await enforceRateLimit({
    action,
    identifier: getClientIdentifier(request),
    limit: 120,
    windowSeconds: 60,
    onBackendFailure: "closed",
  });
}

function limitResponse(error: unknown): NextResponse | null {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await limit(req, "dm:typing:get");
    const { id } = await params;
    return NextResponse.json({ typing: await getTyping(id) });
  } catch (error) {
    const limited = limitResponse(error);
    if (limited) return limited;
    return NextResponse.json(
      { error: "Could not load typing" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await limit(req, "dm:typing:set");
    const { id } = await params;
    const body = await req.json();
    await setTyping(id, Boolean(body?.isTyping));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const limited = limitResponse(error);
    if (limited) return limited;
    return NextResponse.json(
      { error: "Could not save typing" },
      { status: 500 },
    );
  }
}
