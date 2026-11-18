export type SyncAttendanceStatus = "hadir" | "izin" | "sakit" | "alpa";

export type SyncStudentRecord = {
  nim: string | null;
  displayName: string;
  status: SyncAttendanceStatus;
};

export type SyncSessionPayload = {
  meetingId: string;
  meetingTitle: string;
  className: string;
  expiresAt: string;
  students: SyncStudentRecord[];
};

export type CalibrationProfile = {
  origin: string;
  /** Optional column index (0-based) for multi-column meeting grids */
  targetColumnIndex?: number;
  /** CSS selectors or relative nth-control indices inside a student row */
  statusSelectors?: Partial<Record<SyncAttendanceStatus, string>>;
  /** Input mode learned during calibration */
  mode?: "radio" | "select" | "checkbox" | "button";
  updatedAt: string;
};

export type RowInjectionResult = {
  student: SyncStudentRecord;
  matchedBy: "nim" | "name-fallback" | "unmatched";
  applied: boolean;
  reason?: string;
};

export type InjectionSummary = {
  total: number;
  matchedByNim: number;
  matchedByNameFallback: number;
  unmatched: number;
  results: RowInjectionResult[];
};

export type InjectAttendanceOptions = {
  calibration?: CalibrationProfile;
  delayMs?: number;
  dryRun?: boolean;
  onProgress?: (done: number, total: number) => void;
};
