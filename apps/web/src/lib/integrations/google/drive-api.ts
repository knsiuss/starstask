"server-only";

import { GOOGLE_DRIVE_API_BASE } from "@/lib/integrations/google/drive-config";

const REQUEST_TIMEOUT_MS = 30_000;

export type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
};

/** Downloads a file the user picked (drive.file scope) as raw bytes. */
export async function downloadDriveFile(
  accessToken: string,
  fileId: string,
): Promise<{ meta: DriveFileMeta; bytes: Uint8Array }> {
  const metaResponse = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!metaResponse.ok) {
    throw new Error("Could not read the Drive file.");
  }
  const meta = (await metaResponse.json()) as DriveFileMeta;

  const fileResponse = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!fileResponse.ok) {
    throw new Error("Could not download the Drive file.");
  }

  const bytes = new Uint8Array(await fileResponse.arrayBuffer());
  return { meta, bytes };
}
