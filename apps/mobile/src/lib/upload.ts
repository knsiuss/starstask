import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

import { getSupabase } from "./supabase";

/**
 * Assignment attachment upload from the Expo shell.
 *
 * Validation mirrors the web app: size cap and extension whitelist,
 * and the storage bucket enforces the same MIME list server-side.
 */

export type UploadResult =
  { ok: true; filename: string } | { ok: false; message: string };

const MAX_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  csv: "text/csv",
  ipynb: "application/json",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  zip: "application/zip",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
};

export function validateUploadFile(name: string, size: number): UploadResult | null {
  if (size <= 0) {
    return { ok: false, message: "The file is empty." };
  }

  if (size > MAX_BYTES) {
    return { ok: false, message: "Each file must be 10 MB or smaller." };
  }

  const extension = name.split(".").pop()?.toLowerCase() ?? "";

  if (!MIME_BY_EXTENSION[extension]) {
    return {
      ok: false,
      message: `Type .${extension} is not allowed for attachments.`,
    };
  }

  return null;
}

export async function pickAndUploadAttachment(
  userId: string,
  assignmentId: string,
): Promise<UploadResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
  });

  if (picked.canceled || !picked.assets[0]) {
    return { ok: false, message: "No file selected." };
  }

  const file = picked.assets[0];
  const invalid = validateUploadFile(file.name, file.size ?? 0);

  if (invalid) {
    return invalid;
  }

  const supabase = getSupabase();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_BY_EXTENSION[extension] as string;
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const storagePath = `${userId}/${assignmentId}/${Date.now()}-${safeName}`;

  const bytes = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0));

  const { error: uploadError } = await supabase.storage
    .from("assignment-attachments")
    .upload(storagePath, binary, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "private, max-age=0",
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { error: recordError } = await supabase
    .from("assignment_attachments")
    .insert({
      assignment_id: assignmentId,
      storage_path: storagePath,
      original_filename: safeName,
      mime_type: mimeType,
      file_size: file.size ?? 0,
    });

  if (recordError) {
    await supabase.storage.from("assignment-attachments").remove([storagePath]);
    return { ok: false, message: recordError.message };
  }

  return { ok: true, filename: safeName };
}
