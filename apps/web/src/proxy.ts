import type { NextRequest } from "next/server";

import { buildContentSecurityPolicy, createCspNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const nonce = createCspNonce();
  const policy = buildContentSecurityPolicy(nonce);

  // Next.js reads the nonce from `x-nonce` / CSP request headers and attaches
  // it to the scripts it renders; the response header enforces the policy.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", policy);

  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", policy);

  return response;
}

export const config = {
  matcher: [
    /*
     * Refresh sessions on application routes only. Static assets and image
     * optimization requests never need an auth round-trip.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
