"server-only";

import {
  getGoogleDriveConfig,
  isGoogleDriveConfigured,
} from "@/lib/integrations/google/drive-config";
import {
  decryptToken,
  encryptToken,
} from "@/lib/integrations/google/token-crypto";
import { refreshAccessToken } from "@/lib/integrations/google/oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DriveConnectionStatus = "connected" | "revoked" | "error";

export type DriveConnectionPublic = {
  status: DriveConnectionStatus;
  scope: string;
  driveEmail: string | null;
  connectedAt: string;
};

type StoredConnection = {
  scope: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string;
  status: string;
  drive_email: string | null;
  connected_at: string;
};

const EXPIRY_SKEW_MS = 60_000;

function admin() {
  return createSupabaseAdminClient() as unknown as {
    from: (table: string) => {
      select: (columns?: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          single: () => Promise<{
            data: StoredConnection | null;
            error: unknown;
          }>;
        };
      };
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string },
      ) => Promise<{ error: unknown }>;
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ error: unknown }>;
      };
      delete: () => {
        eq: (column: string, value: string) => Promise<{ error: unknown }>;
      };
    };
  };
}

export async function saveDriveConnection(
  userId: string,
  tokens: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string;
    scope: string;
  },
  driveEmail: string | null = null,
): Promise<void> {
  const config = getGoogleDriveConfig();
  const { error } = await admin()
    .from("google_drive_connections")
    .upsert(
      {
        user_id: userId,
        scope: tokens.scope,
        access_token_ciphertext: encryptToken(
          tokens.accessToken,
          config.encryptionKey,
          "drive",
        ),
        // Google omits the refresh token on reconnects without consent.
        // Never overwrite a stored refresh token with null; only a new one
        // replaces it.
        ...(tokens.refreshToken
          ? {
              refresh_token_ciphertext: encryptToken(
                tokens.refreshToken,
                config.encryptionKey,
                "drive",
              ),
            }
          : {}),
        token_expires_at: tokens.expiresAt,
        status: "connected",
        drive_email: driveEmail,
        last_error_category: null,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) throw new Error("Could not save Drive connection.");
}

export async function getDriveConnectionPublic(
  userId: string,
): Promise<DriveConnectionPublic | null> {
  const { data } = await admin()
    .from("google_drive_connections")
    .select(
      "scope, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, status, drive_email, connected_at",
    )
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  const status =
    data.status === "connected" ||
    data.status === "revoked" ||
    data.status === "error"
      ? (data.status as DriveConnectionStatus)
      : "error";

  return {
    status,
    scope: data.scope,
    driveEmail: data.drive_email,
    connectedAt: data.connected_at,
  };
}

/**
 * Returns a valid access token, refreshing when close to expiry.
 * Refresh token is kept from the original grant (Google does not rotate it).
 */
export async function getValidDriveAccessToken(
  userId: string,
): Promise<string> {
  if (!isGoogleDriveConfigured()) {
    throw new Error("Google Drive is not configured.");
  }

  const config = getGoogleDriveConfig();
  const { data } = await admin()
    .from("google_drive_connections")
    .select(
      "scope, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, status, drive_email, connected_at",
    )
    .eq("user_id", userId)
    .single();

  if (!data || data.status !== "connected") {
    throw new Error("Google Drive is not connected.");
  }

  const expiresAt = new Date(data.token_expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > EXPIRY_SKEW_MS) {
    return decryptToken(
      data.access_token_ciphertext,
      config.encryptionKey,
      "drive",
    );
  }

  if (!data.refresh_token_ciphertext) {
    throw new Error("Google Drive needs to be reconnected.");
  }

  const refreshToken = decryptToken(
    data.refresh_token_ciphertext,
    config.encryptionKey,
    "drive",
  );
  const refreshed = await refreshAccessToken(config, refreshToken);

  await admin()
    .from("google_drive_connections")
    .update({
      access_token_ciphertext: encryptToken(
        refreshed.accessToken,
        config.encryptionKey,
        "drive",
      ),
      token_expires_at: refreshed.expiresAt,
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return refreshed.accessToken;
}

export async function disconnectDrive(userId: string): Promise<void> {
  await admin().from("google_drive_connections").delete().eq("user_id", userId);
}
