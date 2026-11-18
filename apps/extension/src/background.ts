import type { SyncSessionPayload } from "./core/types";
import type {
  ExchangeSyncCodeRequest,
  ExchangeSyncCodeResponse,
} from "./popup/messages";

function normalizeBaseUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol === "https:") {
      return parsed.origin;
    }

    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return parsed.origin;
    }

    return null;
  } catch {
    return null;
  }
}

function isSyncSessionPayload(value: unknown): value is SyncSessionPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.meetingId === "string" &&
    typeof record.meetingTitle === "string" &&
    typeof record.className === "string" &&
    typeof record.expiresAt === "string" &&
    Array.isArray(record.students)
  );
}

function unwrapSyncSessionPayload(body: unknown): SyncSessionPayload | null {
  if (isSyncSessionPayload(body)) {
    return body;
  }

  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;

    if (isSyncSessionPayload(record.data)) {
      return record.data;
    }
  }

  return null;
}

function extractErrorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;

    if (typeof record.error === "string" && record.error.trim().length > 0) {
      return record.error.trim();
    }

    if (typeof record.error === "object" && record.error !== null) {
      const errorRecord = record.error as Record<string, unknown>;

      if (
        typeof errorRecord.message === "string" &&
        errorRecord.message.trim().length > 0
      ) {
        return errorRecord.message.trim();
      }
    }

    if (
      typeof record.message === "string" &&
      record.message.trim().length > 0
    ) {
      return record.message.trim();
    }
  }

  if (status === 401 || status === 403) {
    return "Sync code is invalid or expired.";
  }

  if (status === 404) {
    return "Sync endpoint not found on the configured StarsTask URL.";
  }

  return `Failed to fetch roster (HTTP ${status}).`;
}

async function handleExchangeSyncCode(
  request: ExchangeSyncCodeRequest,
): Promise<ExchangeSyncCodeResponse> {
  const baseUrl = normalizeBaseUrl(request.baseUrl);

  if (!baseUrl) {
    return {
      ok: false,
      error: "Invalid StarsTask URL. Use https:// or http://localhost.",
    };
  }

  const code = request.code.trim();

  if (!code) {
    return { ok: false, error: "Please enter a sync code." };
  }

  try {
    const response = await fetch(`${baseUrl}/api/attendance/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    let parsedBody: unknown = null;

    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        error: extractErrorMessage(parsedBody, response.status),
      };
    }

    const payload = unwrapSyncSessionPayload(parsedBody);

    if (!payload) {
      return {
        ok: false,
        error: "Unexpected response format from StarsTask sync endpoint.",
      };
    }

    return { ok: true, payload };
  } catch {
    return {
      ok: false,
      error: "Unable to reach the StarsTask server. Check the URL and network.",
    };
  }
}

function isExchangeSyncCodeRequest(
  message: unknown,
): message is ExchangeSyncCodeRequest {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const record = message as Record<string, unknown>;

  return (
    record.type === "EXCHANGE_SYNC_CODE" &&
    typeof record.baseUrl === "string" &&
    typeof record.code === "string"
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isExchangeSyncCodeRequest(message)) {
    return false;
  }

  void handleExchangeSyncCode(message).then(sendResponse);
  return true;
});
