import "server-only";

import type ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ExportBrandingInput } from "@starstask/contracts";

import type { AttendanceExportContext } from "./excel";
import { resolveFooterText } from "@/features/export-branding/config";

const HEADER_FILL = "FF0F172A";
const MUTED_TEXT = "FF64748B";
const LOGO_SIZE_PX = 44;
const IMAGE_FETCH_TIMEOUT_MS = 5_000;

type ImageExtension = "png" | "jpg" | "gif";

/**
 * Renders the campus printout header: a 3-part block (left: university logo +
 * name + tagline; center: name / faculty / study program; right: product logo
 * + name + tagline), a navy divider, the address strip, and the navy title
 * bar. All images are best-effort — a missing logo never fails the export.
 *
 * Rows 1–5 are written; row 6 stays blank so the course block keeps its own
 * breathing room. Returns the next free row number.
 */
export async function addBrandingHeader(
  sheet: ExcelJS.Worksheet,
  branding: ExportBrandingInput,
  context: AttendanceExportContext,
  totalColumns: number,
): Promise<number> {
  void context;

  const midColumn = Math.max(4, Math.floor(totalColumns / 2));

  // Left block: university logo + name + tagline.
  const leftIndent = branding.universityLogoUrl.trim() !== "" ? 6 : 1;
  const leftTop = sheet.getRow(1).getCell(1);
  sheet.mergeCells(1, 1, 2, Math.min(3, midColumn));
  leftTop.value = [branding.universityName, branding.universityTagline]
    .filter(Boolean)
    .join("\n") || "Universitas";
  leftTop.font = { size: 14, bold: true };
  leftTop.alignment = { indent: leftIndent, vertical: "middle", wrapText: true };
  sheet.getRow(1).height = 30;

  // Center block: institution, faculty, study program.
  const centerColumn = 4;
  const centerTop = sheet.getRow(1).getCell(centerColumn);
  sheet.mergeCells(1, centerColumn, 2, midColumn);
  centerTop.value = [
    branding.universityName,
    branding.faculty,
    branding.studyProgram,
  ]
    .filter(Boolean)
    .join("\n") || "Fakultas / Program Studi";
  centerTop.font = { size: 12, bold: true };
  centerTop.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  // Right block: product logo + name + tagline.
  const rightColumn = midColumn + 1;
  const rightIndent = branding.productLogoUrl.trim() !== "" ? 6 : 1;
  const rightTop = sheet.getRow(1).getCell(rightColumn);
  sheet.mergeCells(1, rightColumn, 2, totalColumns);
  rightTop.value = [branding.productName, branding.productTagline]
    .filter(Boolean)
    .join("\n");
  rightTop.font = { size: 12, bold: true };
  rightTop.alignment = {
    horizontal: "right",
    indent: rightIndent,
    vertical: "middle",
    wrapText: true,
  };

  await addLogoImage(sheet, branding.universityLogoUrl, 0, 0);
  await addLogoImage(sheet, branding.productLogoUrl, totalColumns - 1, 0);

  // Navy divider.
  const dividerRow = sheet.getRow(3);
  dividerRow.height = 6;
  for (let column = 1; column <= totalColumns; column += 1) {
    dividerRow.getCell(column).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
  }

  // Address strip.
  const addressRow = sheet.getRow(4);
  sheet.mergeCells(4, 1, 4, totalColumns);
  const addressParts = [
    [branding.address, branding.city].filter(Boolean).join(", "),
    branding.officialEmail,
    branding.contactNumber,
    branding.officialWebsite,
  ].filter(Boolean);
  addressRow.getCell(1).value =
    addressParts.length > 0 ? addressParts.join("  |  ") : "";
  addressRow.getCell(1).font = { size: 9, color: { argb: MUTED_TEXT } };
  addressRow.height = 14;

  // Navy title bar.
  const titleRow = sheet.getRow(5);
  sheet.mergeCells(5, 1, 5, totalColumns);
  titleRow.getCell(1).value = branding.documentTitle;
  titleRow.getCell(1).font = {
    size: 13,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  titleRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL },
  };
  titleRow.getCell(1).alignment = { vertical: "middle", wrapText: true };
  titleRow.height = 26;

  return 7;
}

/**
 * Attribution line below the recap notes: footer text, print timestamp, and an
 * optional product footer. The &P / &N page numbers stay in the sheet footer.
 */
export function addBrandingFooterNote(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  totalColumns: number,
  branding: ExportBrandingInput,
  printedAt: string,
): void {
  sheet.mergeCells(rowNumber, 1, rowNumber, totalColumns);
  const cell = sheet.getRow(rowNumber).getCell(1);
  const parts = [
    resolveFooterText(branding),
    `Dicetak pada ${printedAt}`,
  ];
  if (branding.productFooter) {
    parts.push(branding.productFooter);
  }
  cell.value = parts.join(" · ");
  cell.font = { size: 9, italic: true, color: { argb: MUTED_TEXT } };
}

async function addLogoImage(
  sheet: ExcelJS.Worksheet,
  imageUrl: string,
  col: number,
  row: number,
): Promise<void> {
  if (!imageUrl) {
    return;
  }

  try {
    const image = await loadImage(imageUrl);
    const imageId = sheet.workbook.addImage(image);
    sheet.addImage(imageId, { tl: { col, row }, ext: { width: LOGO_SIZE_PX, height: LOGO_SIZE_PX } });
  } catch {
    // Best-effort: a logo that cannot be fetched never fails the export.
  }
}

async function loadImage(
  imageUrl: string,
): Promise<{ buffer: Buffer; extension: ImageExtension }> {
  const normalized = imageUrl.trim();
  const extension = extensionFor(normalized);

  if (normalized.startsWith("https://")) {
    const response = await fetch(normalized, {
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error("Logo URL unreachable");
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    return { buffer: bytes, extension };
  }

  if (normalized.startsWith("/") && !normalized.startsWith("/api/")) {
    const relative = normalized.replace(/^\/+/, "");
    if (!relative || relative.includes("..")) {
      throw new Error("Invalid logo path");
    }

    const buffer = await readFile(
      path.resolve(process.cwd(), "public", relative),
    );

    return { buffer, extension };
  }

  throw new Error("Unsupported logo location");
}

function extensionFor(imageUrl: string): ImageExtension {
  const pathname = imageUrl.split("?")[0] ?? "";
  const extension = pathname.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "jpg";
  }

  if (extension === "gif") {
    return "gif";
  }

  return "png";
}
