import { afterEach, describe, expect, it, vi } from "vitest";

import { aiVisionProvider } from "@/lib/ocr/ai-vision";

const originalApiKey = process.env.AI_VISION_API_KEY;
const originalBaseUrl = process.env.AI_VISION_BASE_URL;
const originalModel = process.env.AI_VISION_MODEL;

function setEnv(key: string, value: string) {
  process.env[key] = value;
}

function clearEnv() {
  delete process.env.AI_VISION_API_KEY;
  delete process.env.AI_VISION_BASE_URL;
  delete process.env.AI_VISION_MODEL;
}

function restoreEnv() {
  if (originalApiKey === undefined) delete process.env.AI_VISION_API_KEY;
  else process.env.AI_VISION_API_KEY = originalApiKey;
  if (originalBaseUrl === undefined) delete process.env.AI_VISION_BASE_URL;
  else process.env.AI_VISION_BASE_URL = originalBaseUrl;
  if (originalModel === undefined) delete process.env.AI_VISION_MODEL;
  else process.env.AI_VISION_MODEL = originalModel;
}

afterEach(() => {
  restoreEnv();
  vi.unstubAllGlobals();
});

describe("aiVisionProvider", () => {
  it("supports PDFs and common image types only", () => {
    expect(aiVisionProvider.supports("application/pdf")).toBe(true);
    expect(aiVisionProvider.supports("image/jpeg")).toBe(true);
    expect(aiVisionProvider.supports("image/png")).toBe(true);
    expect(aiVisionProvider.supports("image/webp")).toBe(true);
    expect(aiVisionProvider.supports("text/plain")).toBe(false);
  });

  it("reports unsupported when no API key is configured", async () => {
    clearEnv();

    const outcome = await aiVisionProvider.extract({
      bytes: new Uint8Array([137, 80, 78, 71]),
      mimeType: "image/png",
    });

    expect(outcome.status).toBe("unsupported");
  });

  it("returns the transcription text on success", async () => {
    setEnv("AI_VISION_API_KEY", "test-key");
    setEnv("AI_VISION_BASE_URL", "https://ai.example.test/v1");
    setEnv("AI_VISION_MODEL", "test-model");

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: "1 TPL0101 Example Senin 13.00-15.00" } },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await aiVisionProvider.extract({
      bytes: new Uint8Array([137, 80, 78, 71]),
      mimeType: "image/png",
    });

    expect(outcome.status).toBe("succeeded");
    if (outcome.status === "succeeded") {
      expect(outcome.text).toContain("TPL0101");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports failed when the endpoint is unreachable", async () => {
    setEnv("AI_VISION_API_KEY", "test-key");
    setEnv("AI_VISION_BASE_URL", "https://ai.example.test/v1");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const outcome = await aiVisionProvider.extract({
      bytes: new Uint8Array([137, 80, 78, 71]),
      mimeType: "image/png",
    });

    expect(outcome.status).toBe("failed");
  });
});
