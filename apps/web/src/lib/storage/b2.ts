"server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

/**
 * Backblaze B2 (S3-compatible) — free tier: 10GB storage, 1GB download/hari.
 * Env: B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_REGION
 * Region contoh: us-west-001, eu-central-003
 * Endpoint S3: https://s3.{region}.backblazeb2.com
 */

type B2Config = {
  keyId: string;
  applicationKey: string;
  bucketName: string;
  region: string;
};

function getB2Config(): B2Config | null {
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

export async function uploadToB2(
  objectName: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ url: string; path: string }> {
  const config = getB2Config();
  if (!config) throw new Error("B2 not configured");
  const key = `${randomUUID()}-${objectName}`;
  const client = new S3Client({
    region: config.region,
    endpoint: `https://s3.${config.region}.backblazeb2.com`,
    credentials: {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey,
    },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: bytes as never,
      ContentType: mimeType,
    }),
  );
  const url = `https://${config.bucketName}.s3.${config.region}.backblazeb2.com/${key}`;
  return { url, path: key };
}

export async function uploadToStorage(
  objectName: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ url: string; path: string; provider: "r2" | "b2" | "supabase" }> {
  // Prioritas: B2 (tanpa kartu kredit) → R2 → Supabase (fallback)
  // R2 skip: Cloudflare butuh kartu kredit buat verifikasi, ditolak user 2026-11-05.
  if (isB2Configured()) {
    const b2 = await uploadToB2(objectName, bytes, mimeType);
    return { ...b2, provider: "b2" };
  }
  const { isR2Configured, uploadToR2 } = await import("@/lib/storage/r2");
  if (isR2Configured()) {
    const r2 = await uploadToR2(objectName, bytes, mimeType);
    return { ...r2, provider: "r2" };
  }
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const key = `${randomUUID()}-${objectName}`;
  const { error } = await supabase.storage
    .from("assignment-attachments")
    .upload(key, bytes, { contentType: mimeType, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage
    .from("assignment-attachments")
    .getPublicUrl(key);
  return { url: data.publicUrl, path: key, provider: "supabase" };
}
