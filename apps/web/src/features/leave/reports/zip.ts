import "server-only";

import JSZip from "jszip";

import { sanitizeFilenameSegment } from "@starstask/shared";

import type { LeaveReportRow } from "@/lib/db/leave";
import type {
  MissingAttachment,
  EvidenceSource,
} from "@/features/leave/reports/pdf";

/**
 * Optional ZIP package: the summary PDF, the original documents, and a manifest.
 *
 * JSZip never touches the filesystem, so classic archive traversal is not
 * possible; names are still sanitised and prefixed with the request reference to
 * prevent collisions when two students upload `surat.pdf`.
 */

export type ZipBuild = {
  bytes: Uint8Array;
  missing: MissingAttachment[];
};

/** Strips directory components and unsafe characters from an archive entry. */
function safeEntryName(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return cleaned.length > 0 ? cleaned : "file";
}

export async function buildLeaveZip(options: {
  summaryPdf: Uint8Array;
  rows: LeaveReportRow[];
  evidenceByRequest: Map<string, EvidenceSource[]>;
  load: (storagePath: string) => Promise<Uint8Array | null>;
  manifestCsv: string;
}): Promise<ZipBuild> {
  const zip = new JSZip();
  const missing: MissingAttachment[] = [];

  zip.file("leave-report-summary.pdf", options.summaryPdf);
  zip.file("manifest.csv", options.manifestCsv);

  const evidenceFolder = zip.folder("evidence");

  for (const row of options.rows) {
    const evidence = options.evidenceByRequest.get(row.id) ?? [];

    for (const [index, item] of evidence.entries()) {
      const bytes = await options.load(item.storagePath);

      if (!bytes) {
        missing.push({
          reference: row.reference,
          filename: item.originalFilename,
          reason: "The file could not be downloaded.",
        });
        continue;
      }

      // Reference first, so entries sort next to their request and can never
      // collide with another request's file of the same name.
      const entry = `${sanitizeFilenameSegment(row.reference, 24)}-${index + 1}-${safeEntryName(item.originalFilename)}`;
      evidenceFolder?.file(entry, bytes);
    }
  }

  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { bytes, missing };
}
