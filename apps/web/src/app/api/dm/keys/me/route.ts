import { NextResponse } from "next/server";

import { getOwnPublicKey, upsertOwnPublicKey } from "@/lib/db/direct-messages";

export async function GET() {
  try {
    const publicKey = await getOwnPublicKey();

    return NextResponse.json({ publicKey });
  } catch {
    return NextResponse.json({ error: "Could not load key" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const publicKey = body?.publicKey;

    if (
      typeof publicKey !== "string" ||
      publicKey.length === 0 ||
      publicKey.length > 500
    ) {
      return NextResponse.json(
        { error: "Invalid public key" },
        { status: 400 },
      );
    }

    await upsertOwnPublicKey(publicKey);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save key" }, { status: 500 });
  }
}
