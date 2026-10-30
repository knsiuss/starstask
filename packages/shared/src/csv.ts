/**
 * Minimal RFC 4180 CSV writer with formula-injection protection.
 *
 * No dependency is used on purpose: the security-relevant behaviour is the
 * injection guard, and that belongs in reviewed, tested code rather than in
 * whatever a third-party serialiser decides to do.
 */

export const CSV_MIME_TYPE = "text/csv; charset=utf-8";

/** Byte-order mark so Excel opens UTF-8 names and accents correctly. */
export const CSV_BOM = "\uFEFF";

/**
 * Characters that make a spreadsheet treat a cell as a formula.
 *
 * Excel, LibreOffice, and Google Sheets all evaluate a cell beginning with one
 * of these, so a student nickname like `=HYPERLINK(...)` would execute on the
 * reviewer's machine.
 */
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Neutralises a leading formula character by prefixing an apostrophe.
 *
 * The apostrophe is the conventional escape: spreadsheets render the text
 * literally and do not show the quote. Both the raw first character and the
 * first non-whitespace character are checked, because `\t=SUM(A1)` and
 * `   =SUM(A1)` are evaluated just like `=SUM(A1)` — trimming alone would miss
 * the tab and carriage-return cases.
 */
export function escapeCsvFormula(value: string): string {
  const firstChar = value.charAt(0);

  if (FORMULA_TRIGGERS.has(firstChar)) {
    return `'${value}`;
  }

  const firstMeaningful = value.trimStart().charAt(0);

  if (firstMeaningful && FORMULA_TRIGGERS.has(firstMeaningful)) {
    return `'${value}`;
  }

  return value;
}

/**
 * Quotes a cell when it contains a delimiter, a quote, or a newline.
 *
 * Always quotes after formula escaping if the value would otherwise be
 * ambiguous; a bare `'` prefix is safe without quotes.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = escapeCsvFormula(raw);

  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }

  return guarded;
}

/**
 * Serialises a header row and body rows.
 *
 * Line endings are CRLF because that is what RFC 4180 specifies and what
 * spreadsheet applications expect. The trailing CRLF is included so a file
 * always ends with a complete record.
 */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];

  return `${lines.join("\r\n")}\r\n`;
}

/** Prefixes the BOM for a downloadable file. */
export function withBom(csv: string): string {
  return `${CSV_BOM}${csv}`;
}
