import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { ApiError } from "@/lib/api/errors";
import { handleRouteError } from "@/lib/api/responses";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getB2Config } from "@/lib/storage/b2";

export const dynamic = "force-dynamic";

// Avatars and class media live in the private B2 bucket; this route streams
// them to the browser so images can keep using plain URLs (no signed-URL
// expiry). Same exposure as the old public Supabase buckets.

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const KEY_PATTERN = /^[a-z-]+\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\.(png|jpe?g)$/;

/**
 * GET /api/media/{kind}/{ownerId}/{objectName}.{ext}
 * Streams one image from B2. The key shape is validated so this route can
 * never reach attachment objects (different namespace, no dots).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    await enforceRateLimit({
      action: "media:read",
      identifier: "media",
      limit: 120,
      windowSeconds: 60,
    });

    const { path } = await context.params;
    const key = path.join("/");
    const extension = key.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = MIME_BY_EXTENSION[extension];

    if (!KEY_PATTERN.test(key) || !mimeType) {
      throw new ApiError(400, "invalid_path", "Invalid media path.");
    }

    const config = getB2Config();
    if (!config) {
      throw new ApiError(503, "not_configured", "Storage not configured.");
    }

    const client = new S3Client({
      region: config.region,
      endpoint: `https://s3.${config.region}.backblazeb2.com`,
      credentials: {
        accessKeyId: config.keyId,
        secretAccessKey: config.applicationKey,
      },
    });

    const { Body } = await client.send(
      new GetObjectCommand({ Bucket: config.bucketName, Key: key }),
    );

    if (!Body) {
      throw new ApiError(404, "not_found", "Media not found.");
    }

    const bytes = new Uint8Array(await Body.transformToByteArray());

    return new Response(bytes, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(bytes.byteLength),
        // Images are content-addressed by UUID; they never change.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
