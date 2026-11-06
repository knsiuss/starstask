"server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

import { ATTACHMENT_BUCKET, SIGNED_URL_TTL_SECONDS } from "./attachments";

export type StorageProvider = "b2" | "r2" | "supabase";

export type StoredObject = {
  path: string;
  provider: StorageProvider;
};

/**
 * Backblaze B2 (S3-compatible) — free tier: 10GB storage, 1GB download/hari.
 * Env: B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_REGION
 * Region contoh: us-west-001, eu-central-003
 * Endpoint S3: https://s3.{region}.backblazeb2.com
 */

export type B2Config = {
  keyId: string;
  applicationKey: string;
  bucketName: string;
  region: string;
};

export function getB2Config(): B2Config | null {
  const keyId = process.env.B2_APPLICATION_KEY_ID?.trim();
  const applicationKey = process.env.B2_APPLICATION_KEY?.trim();
  const bucketName = process.env.B2_BUCKET_NAME?.trim();
  const region = process.env.B2_REGION?.trim();
  if (!keyId || !applicationKey || !bucketName || !region) return null;
  return { keyId, applicationKey, bucketName, region };
}

export function isB2Configured(): boolean {
  return getB2Config() !== null;
}

export async function uploadToStorage(
  objectName: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ url: string; path: string; provider: StorageProvider }> {
  // The caller owns the object name; the key gets a random prefix so uploads
  // can never overwrite each other.
  return uploadToStorageWithKey(
    `${randomUUID()}-${objectName}`,
    bytes,
    mimeType,
  );
}

/**
 * Uploads to the first configured backend (B2 -> R2 -> Supabase) under the
 * caller-provided key. Every upload path in the app goes through here so a
 * file's backend is always known and recorded in its row.
 */
export async function uploadToStorageWithKey(
  key: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ url: string; path: string; provider: StorageProvider }> {
  // Prioritas: B2 (tanpa kartu kredit) → R2 → Supabase (fallback)
  // R2 skip: Cloudflare butuh kartu kredit buat verifikasi, ditolak user 2026-11-05.
  if (isB2Configured()) {
    const url = await putToB2(key, bytes, mimeType);
    return { url, path: key, provider: "b2" };
  }
  const { isR2Configured, uploadToR2WithKey } =
    await import("@/lib/storage/r2");
  if (isR2Configured()) {
    const url = await uploadToR2WithKey(key, bytes, mimeType);
    return { url, path: key, provider: "r2" };
  }
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(key, bytes, { contentType: mimeType, upsert: false });
  if (error) throw error;

  // Same posture as the B2/R2 path and `getAttachmentViews`: the bucket is
  // private, so hand out a short-lived signed URL instead of a public one.
  const { data, error: signError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);

  if (signError || !data) throw signError ?? new Error("Could not sign upload");

  return { url: data.signedUrl, path: key, provider: "supabase" };
}

/** Puts one object at `key` in the B2 bucket; returns a signed GET URL. */
async function putToB2(
  key: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const config = getB2Config();
  if (!config) throw new Error("B2 not configured");
  const client = createB2Client(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: bytes as never,
      ContentType: mimeType,
    }),
  );
  // The bucket is private: callers only ever receive a short-lived signed
  // URL, never a public one, so a leaked link dies with SIGNED_URL_TTL_SECONDS.
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.bucketName, Key: key }),
    { expiresIn: SIGNED_URL_TTL_SECONDS },
  );
}

function createB2Client(config: B2Config): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: `https://s3.${config.region}.backblazeb2.com`,
    credentials: {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey,
    },
  });
}

/**
 * Signs a short-lived read URL for a stored object, on whichever backend
 * holds it. `download: true` adds a Content-Disposition so the browser
 * saves the file instead of opening it.
 */
export async function signStorageUrl(
  provider: string,
  path: string,
  options?: { download?: string },
): Promise<string> {
  if (provider === "supabase") {
    const { createSupabaseServerClient } =
      await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, {
        download: options?.download ?? undefined,
      });
    if (error || !data) {
      throw error ?? new Error("Could not sign stored file");
    }
    return data.signedUrl;
  }

  const client = createS3ClientFor(provider);
  const command = new GetObjectCommand({
    Bucket: bucketFor(provider),
    Key: path,
    ...(options?.download
      ? {
          ResponseContentDisposition: `attachment; filename="${options.download}"`,
        }
      : {}),
  });
  return getSignedUrl(client, command, {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
}

/** Deletes one stored object from whichever backend holds it. */
export async function deleteStoredObject(
  provider: string,
  path: string,
): Promise<void> {
  if (provider === "supabase") {
    const { createSupabaseServerClient } =
      await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove([path]);
    if (error) throw error;
    return;
  }

  const client = createS3ClientFor(provider);
  await client.send(
    new DeleteObjectCommand({ Bucket: bucketFor(provider), Key: path }),
  );
}

function createS3ClientFor(provider: string): S3Client {
  if (provider === "r2") {
    const accountId = process.env.R2_ACCOUNT_ID?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 not configured");
    }
    return new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  const config = getB2Config();
  if (!config) throw new Error("B2 not configured");
  return createB2Client(config);
}

function bucketFor(provider: string): string {
  if (provider === "r2") {
    const bucket = process.env.R2_BUCKET?.trim();
    if (!bucket) throw new Error("R2 not configured");
    return bucket;
  }

  const config = getB2Config();
  if (!config) throw new Error("B2 not configured");
  return config.bucketName;
}
