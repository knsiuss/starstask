import "server-only";

import type ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ExportBrandingInput } from "@starstask/contracts";

import type { AttendanceExportContext } from "./excel";
import { resolveFooterText } from "@/features/export-branding/config";

const HEADER_FILL = "FF0F172A";
const MUTED_TEXT = "FF64748B";
const LOGO_SIZE_PX = 40;
const IMAGE_FETCH_TIMEOUT_MS = 5_000;
const FALLBACK_PRODUCT_LOGOS = ["/aphelion-logo.png", "/brand/logo-mark.png"];

type ImageExtension = "png" | "jpeg" | "gif";

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

  const leftEnd =
    totalColumns >= 6
      ? Math.max(2, Math.floor(totalColumns * 0.28))
      : Math.max(1, Math.floor(totalColumns / 2));
  const rightStart =
    totalColumns >= 6
      ? Math.max(
          leftEnd + 2,
          totalColumns - Math.max(2, Math.floor(totalColumns * 0.28)) + 1,
        )
      : leftEnd + 1;
  const hasCenter = totalColumns >= 6 && rightStart - leftEnd > 1;

  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 24;

  // Left block: university logo + name + tagline.
  const hasUniLogo = branding.universityLogoUrl.trim() !== "";
  const leftTop = sheet.getRow(1).getCell(1);
  sheet.mergeCells(1, 1, 2, leftEnd);
  leftTop.value =
    [branding.universityName, branding.universityTagline]
      .filter(Boolean)
      .join("\n") || "Universitas";
  leftTop.font = { size: 12, bold: true, color: { argb: HEADER_FILL } };
  leftTop.alignment = {
    indent: hasUniLogo ? 5 : 1,
    vertical: "middle",
    wrapText: true,
  };

  // Center block: institution, faculty, study program.
  if (hasCenter) {
    const centerColumn = leftEnd + 1;
    const centerTop = sheet.getRow(1).getCell(centerColumn);
    sheet.mergeCells(1, centerColumn, 2, rightStart - 1);
    centerTop.value =
      [branding.universityName, branding.faculty, branding.studyProgram]
        .filter(Boolean)
        .join("\n") || "Fakultas / Program Studi";
    centerTop.font = { size: 11, bold: true, color: { argb: HEADER_FILL } };
    centerTop.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  }

  // Right block: product logo + name + tagline.
  const rightTop = sheet.getRow(1).getCell(rightStart);
  sheet.mergeCells(1, rightStart, 2, totalColumns);
  rightTop.value = [
    branding.productName || "Aphelion",
    branding.productTagline || "Academic Productivity",
  ]
    .filter(Boolean)
    .join("\n");
  rightTop.font = { size: 11, bold: true, color: { argb: HEADER_FILL } };
  rightTop.alignment = {
    horizontal: "right",
    indent: 5,
    vertical: "middle",
    wrapText: true,
  };

  if (hasUniLogo) {
    await addLogoImage(sheet, [branding.universityLogoUrl], 0.1, 0.1);
  }

  const productLogoCandidates = [
    branding.productLogoUrl.trim(),
    ...FALLBACK_PRODUCT_LOGOS,
  ].filter(Boolean);
  await addLogoImage(
    sheet,
    productLogoCandidates,
    Math.max(rightStart - 1, totalColumns - 0.85),
    0.1,
  );

  // Navy divider.
  const dividerRow = sheet.getRow(3);
  dividerRow.height = 5;
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
  addressRow.getCell(1).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  addressRow.height = addressParts.length > 0 ? 18 : 8;

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
  titleRow.getCell(1).alignment = {
    vertical: "middle",
    indent: 1,
    wrapText: true,
  };
  titleRow.height = 28;

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
  const parts = [resolveFooterText(branding), `Dicetak pada ${printedAt}`];
  if (branding.productFooter) {
    parts.push(branding.productFooter);
  }
  cell.value = parts.join(" · ");
  cell.font = { size: 9, italic: true, color: { argb: MUTED_TEXT } };
}

async function addLogoImage(
  sheet: ExcelJS.Worksheet,
  imageUrls: string[],
  col: number,
  row: number,
): Promise<void> {
  for (const imageUrl of imageUrls) {
    if (!imageUrl) continue;

    try {
      const { buffer, extension } = await loadImage(imageUrl);
      // ExcelJS types `buffer` as an ArrayBuffer while the runtime wants raw
      // bytes, so the same payload goes through the typed `base64` field.
      const imageId = sheet.workbook.addImage({
        base64: buffer.toString("base64"),
        extension,
      });
      sheet.addImage(imageId, {
        tl: { col, row },
        ext: { width: LOGO_SIZE_PX, height: LOGO_SIZE_PX },
      });
      return;
    } catch {
      // Try next fallback candidate; missing logo never fails the export.
    }
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

  // ExcelJS only accepts "jpeg", never the "jpg" alias.
  if (extension === "jpg" || extension === "jpeg") {
    return "jpeg";
  }

  if (extension === "gif") {
    return "gif";
  }

  return "png";
}
