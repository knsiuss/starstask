import { NextResponse } from "next/server";

import { apiError, apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { disconnectDrive } from "@/lib/db/google-drive-connections";
import { revokeGoogleToken } from "@/lib/integrations/google/oauth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return apiError(401, "unauthorized", "Sign in to disconnect Drive.");
    }

    await enforceRateLimit({
      action: "integrations:google-drive:disconnect",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    // Revoke via the stored refresh token when available (best effort).
    try {
      const supabase = createSupabaseAdminClient() as unknown as {
        from: (table: string) => {
          select: (columns?: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              single: () => Promise<{
                data: { refresh_token_ciphertext: string | null } | null;
              }>;
            };
          };
        };
      };
      const { data } = await supabase
        .from("google_drive_connections")
        .select("refresh_token_ciphertext")
        .eq("user_id", session.user.id)
        .single();
      if (data?.refresh_token_ciphertext) {
        const { getGoogleDriveConfig } =
          await import("@/lib/integrations/google/drive-config");
        const { decryptToken } =
          await import("@/lib/integrations/google/token-crypto");
        const config = getGoogleDriveConfig();
        const refresh = decryptToken(
          data.refresh_token_ciphertext,
          config.encryptionKey,
        );
        await revokeGoogleToken(refresh);
      }
    } catch {
      // Local disconnect still proceeds.
    }

    await disconnectDrive(session.user.id);
    return apiSuccess({ disconnected: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
