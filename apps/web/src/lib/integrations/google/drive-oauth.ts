"server-only";

import {
  GOOGLE_DRIVE_SCOPE,
  type GoogleDriveConfig,
} from "@/lib/integrations/google/drive-config";
import { GOOGLE_AUTHORIZATION_ENDPOINT } from "@/lib/integrations/google/config";
import type { GoogleCalendarConfig } from "@/lib/integrations/google/config";

export function buildDriveAuthorizationUrl(options: {
  config: GoogleDriveConfig;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: options.config.clientId,
    redirect_uri: options.config.redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: options.state,
  });

  return `${GOOGLE_AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

/** Calendar config shape is identical; share the token exchange helpers. */
export function toCalendarConfig(
  drive: GoogleDriveConfig,
): GoogleCalendarConfig {
  return {
    clientId: drive.clientId,
    clientSecret: drive.clientSecret,
    redirectUri: drive.redirectUri,
    encryptionKey: drive.encryptionKey,
  };
}
