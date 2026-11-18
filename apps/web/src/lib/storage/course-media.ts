import "server-only";

import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const COURSE_MEDIA_BUCKET = "course-media";
export const COURSE_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const COURSE_MEDIA_SIGNED_TTL_SECONDS = 15 * 60;

type MediaRule = {
  mimeType: string;
  magic?: number[];
};

const PNG_RULE: MediaRule = {
  mimeType: "image/png",
  magic: [0x89, 0x50, 0x4e, 0x47],
};
const JPG_RULE: MediaRule = {
  mimeType: "image/jpeg",
  magic: [0xff, 0xd8, 0xff],
};
const WEBP_RULE: MediaRule = {
  mimeType: "image/webp",
  magic: [0x52, 0x49, 0x46, 0x46],
};

const MATERIAL_FILE_RULES: Record<string, MediaRule> = {
  pdf: { mimeType: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  html: { mimeType: "text/html" },
  htm: { mimeType: "text/html" },
  md: { mimeType: "text/markdown" },
  txt: { mimeType: "text/plain" },
  png: PNG_RULE,
  jpg: JPG_RULE,
  jpeg: JPG_RULE,
  webp: WEBP_RULE,
};

const COMMENT_IMAGE_RULES: Record<string, MediaRule> = {
  png: PNG_RULE,
  jpg: JPG_RULE,
  jpeg: JPG_RULE,
  webp: WEBP_RULE,
};

function matchesMagic(bytes: Uint8Array, magic?: number[]): boolean {
  if (!magic || magic.length === 0) {
    return true;
  }

  if (bytes.length < magic.length) {
    return false;
  }

  return magic.every((expected, index) => bytes[index] === expected);
}

export async function uploadCourseMediaFile(params: {
  classId: string;
  subjectId: string;
  folder: "materials" | "comments";
  file: File;
}): Promise<{ path: string; name: string; mimeType: string; size: number }> {
  if (params.file.size <= 0 || params.file.size > COURSE_MEDIA_MAX_BYTES) {
    throw new Error("File must be between 1 byte and 10 MB.");
  }

  const rawName = params.file.name.trim() || "file";
  const ext = rawName.split(".").pop()?.toLowerCase() ?? "";
  const rules =
    params.folder === "comments" ? COMMENT_IMAGE_RULES : MATERIAL_FILE_RULES;
  const rule = rules[ext];

  if (!rule) {
    throw new Error(
      params.folder === "comments"
        ? "Only PNG, JPG, or WebP images are supported in comments."
        : "Supported files: PDF, HTML, Markdown, TXT, PNG, JPG, or WebP.",
    );
  }

  const buffer = new Uint8Array(await params.file.arrayBuffer());

  if (!matchesMagic(buffer, rule.magic)) {
    throw new Error("File contents do not match its file extension.");
  }

  const objectPath = `${params.classId}/${params.subjectId}/${params.folder}/${randomUUID()}.${ext}`;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from(COURSE_MEDIA_BUCKET)
    .upload(objectPath, buffer, {
      contentType: rule.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error("Could not upload the file right now.");
  }

  return {
    path: objectPath,
    name: rawName.slice(0, 200),
    mimeType: rule.mimeType,
    size: params.file.size,
  };
}

export async function createCourseMediaSignedUrls(
  paths: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();

  if (unique.length === 0) {
    return map;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from(COURSE_MEDIA_BUCKET)
      .createSignedUrls(unique, COURSE_MEDIA_SIGNED_TTL_SECONDS);

    if (error || !data) {
      return map;
    }

    for (const item of data) {
      if (item.path && item.signedUrl) {
        map.set(item.path, item.signedUrl);
      }
    }
  } catch {
    return map;
  }

  return map;
}
