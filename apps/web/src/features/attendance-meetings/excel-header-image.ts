import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { readB2ObjectBytes } from "@/lib/storage/b2";

const IMAGE_FETCH_TIMEOUT_MS = 5_000;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const INTERNAL_LOGO_KEY_PATTERN =
  /^\/api\/media\/(class-media\/([A-Za-z0-9-]+)\/branding\/[A-Za-z0-9-]+\.(png|jpe?g))$/;
const SUPABASE_LOGO_PATH_PATTERN =
  /^\/storage\/v1\/object\/public\/class-media\/([A-Za-z0-9-]+)\/branding\/[A-Za-z0-9-]+\.(png|jpe?g)$/;

export type BrandingImageExtension = "png" | "jpeg";

/**
 * Loads a branding logo strictly from allowlisted locations (internal B2
 * branding key, Supabase public class-media URL, or safe `public/` path) and
 * verifies PNG/JPEG magic bytes.
 */
export async function loadBrandingImage(
  imageUrl: string,
  classId?: string,
): Promise<{ buffer: Buffer; extension: BrandingImageExtension }> {
  const normalized = imageUrl.trim();

  if (normalized.startsWith("/api/media/")) {
    const match = INTERNAL_LOGO_KEY_PATTERN.exec(normalized);

    if (!match || !match[1] || !match[2]) {
      throw new Error("Invalid internal logo key");
    }

    if (classId && match[2] !== classId) {
      throw new Error("Logo does not belong to this class");
    }

    const bytes = await readB2ObjectBytes(match[1], MAX_LOGO_BYTES);
    const buffer = Buffer.from(bytes);

    return { buffer, extension: detectImageExtension(buffer) };
  }

  if (normalized.startsWith("https://")) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

    if (!supabaseUrl) {
      throw new Error("Supabase URL not configured");
    }

    const allowedOrigin = new URL(supabaseUrl).origin;
    const parsed = new URL(normalized);

    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.origin !== allowedOrigin ||
      parsed.pathname.includes("..") ||
      parsed.pathname.includes("\\")
    ) {
      throw new Error("Disallowed logo URL");
    }

    const pathMatch = SUPABASE_LOGO_PATH_PATTERN.exec(parsed.pathname);

    if (!pathMatch || !pathMatch[1]) {
      throw new Error("Disallowed logo storage path");
    }

    if (classId && pathMatch[1] !== classId) {
      throw new Error("Logo does not belong to this class");
    }

    const response = await fetch(parsed.toString(), {
      redirect: "error",
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error("Logo URL unreachable");
    }

    const bytes = await readResponseBytesBounded(response, MAX_LOGO_BYTES);

    return { buffer: bytes, extension: detectImageExtension(bytes) };
  }

  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    const relative = normalized.replace(/^\/+/, "");

    if (
      !relative ||
      relative.includes("..") ||
      relative.includes("\\") ||
      relative.includes(":")
    ) {
      throw new Error("Invalid logo path");
    }

    const publicDir = path.resolve(process.cwd(), "public");
    const resolved = path.resolve(publicDir, relative);

    if (!resolved.startsWith(`${publicDir}${path.sep}`)) {
      throw new Error("Invalid logo path");
    }

    const buffer = await readFile(resolved);

    if (buffer.byteLength > MAX_LOGO_BYTES) {
      throw new Error("Logo file too large");
    }

    return { buffer, extension: detectImageExtension(buffer) };
  }

  throw new Error("Unsupported logo location");
}

async function readResponseBytesBounded(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Logo response exceeds size limit");
  }

  const reader = response.body?.getReader();

  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > maxBytes) {
      throw new Error("Logo response exceeds size limit");
    }

    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      total += value.byteLength;

      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Logo response exceeds size limit");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

function detectImageExtension(bytes: Uint8Array): BrandingImageExtension {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (isPng) {
    return "png";
  }

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  if (isJpeg) {
    return "jpeg";
  }

  throw new Error("Unsupported image signature");
}
