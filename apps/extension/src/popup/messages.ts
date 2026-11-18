import type {
  CalibrationProfile,
  InjectionSummary,
  SyncSessionPayload,
  SyncStudentRecord,
} from "../core/types";

export type ExchangeSyncCodeRequest = {
  type: "EXCHANGE_SYNC_CODE";
  baseUrl: string;
  code: string;
};

export type ExchangeSyncCodeResponse =
  { ok: true; payload: SyncSessionPayload } | { ok: false; error: string };

export type InjectAttendanceRequest = {
  type: "INJECT_ATTENDANCE";
  students: SyncStudentRecord[];
  delayMs?: number;
  dryRun?: boolean;
};

export type InjectAttendanceResponse =
  { ok: true; summary: InjectionSummary } | { ok: false; error: string };

export type StartCalibrationRequest = {
  type: "START_CALIBRATION";
};

export type StartCalibrationResponse =
  { ok: true; started: boolean } | { ok: false; error: string };

export type CancelCalibrationRequest = {
  type: "CANCEL_CALIBRATION";
};

export type CancelCalibrationResponse =
  { ok: true } | { ok: false; error: string };

export type GetPageStatusRequest = {
  type: "GET_PAGE_STATUS";
};

export type GetPageStatusResponse =
  | {
      ok: true;
      origin: string;
      hasCalibration: boolean;
      calibrationUpdatedAt?: string;
    }
  | { ok: false; error: string };

export type ClearCalibrationRequest = {
  type: "CLEAR_CALIBRATION";
};

export type ClearCalibrationResponse =
  { ok: true } | { ok: false; error: string };

export type ContentToPopupMessage =
  | { type: "INJECTION_PROGRESS"; done: number; total: number }
  | { type: "CALIBRATION_STEP"; stepPrompt: string }
  | { type: "CALIBRATION_COMPLETE"; profile: CalibrationProfile };

export type TabMessageRequest =
  | InjectAttendanceRequest
  | StartCalibrationRequest
  | CancelCalibrationRequest
  | GetPageStatusRequest
  | ClearCalibrationRequest;
