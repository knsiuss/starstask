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

    // Revoke via the stored refresh token when available (best effort),
    // unless Google Calendar shares the same OAuth client ID and is actively
    // connected for this user (Google revocation invalidates the whole grant).
    try {
      const calendarClientId = (
        process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
      )?.trim();
      const driveClientId = (
        process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
      )?.trim();
      const sharesOAuthClient = Boolean(
        calendarClientId && driveClientId && calendarClientId === driveClientId,
      );

      const supabase = createSupabaseAdminClient() as unknown as {
        from: (table: string) => {
          select: (columns?: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              eq: (
                column2: string,
                value2: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: { status?: string } | null;
                  error: unknown;
                }>;
              };
              single: () => Promise<{
                data: { refresh_token_ciphertext: string | null } | null;
              }>;
            };
          };
        };
      };

      let skipRevoke = false;

      if (sharesOAuthClient) {
        const { data: calendarConnection, error: calendarError } =
          await supabase
            .from("google_calendar_connections")
            .select("status")
            .eq("user_id", session.user.id)
            .eq("status", "connected")
            .maybeSingle();

        // Fail safe: if Calendar is connected or the check fails, do not revoke
        // the shared OAuth grant so Calendar sync keeps working.
        skipRevoke = Boolean(calendarError || calendarConnection);
      }

      if (!skipRevoke) {
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
            "drive",
          );
          await revokeGoogleToken(refresh);
        }
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
