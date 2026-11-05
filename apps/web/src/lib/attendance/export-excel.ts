"use client";

/** Export attendance recap to Excel (CSV compatible, opens in Excel/Sheets). */
export type RecapRow = {
  meetingDate: string;
  title: string;
  studentCode: string;
  displayName: string;
  status: string;
};

export function recapToCsv(rows: RecapRow[]): string {
  const header = "Meeting Date,Title,Student Code,Name,Status";
  const lines = rows.map((r) =>
    [
      r.meetingDate,
      `"${r.title.replace(/"/g, '""')}"`,
      r.studentCode,
      `"${r.displayName.replace(/"/g, '""')}"`,
      r.status,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
