"server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

/**
 * Cloudflare R2 (S3-compatible) — free tier: 10GB storage, $0 egress.
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 * Upload to R2; download via public URL atau signed. Fallback Supabase jika belum dikonfigurasi.
 */

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl: publicUrl ?? "",
  };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

export async function uploadToR2(
  objectName: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ url: string; path: string }> {
  const config = getR2Config();
  if (!config) throw new Error("R2 not configured");
  const key = `${randomUUID()}-${objectName}`;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes as never,
      ContentType: mimeType,
    }),
  );
  const url = config.publicUrl
    ? `${config.publicUrl}/${key}`
    : `r2://${config.bucket}/${key}`;
  return { url, path: key };
}
