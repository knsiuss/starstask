import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** POST-only sign out so a prefetch or image tag cannot log the user out. */
export async function POST(request: Request) {
  const destination = new URL("/", request.url);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(destination, { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(destination, {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}

export function GET() {
  return NextResponse.json(
    { error: { code: "method_not_allowed", message: "Use POST to sign out." } },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
  );
}

export const dynamic = "force-dynamic";
