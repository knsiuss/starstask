import "server-only";

import type { OcrOutcome, OcrProvider } from "./types";

/**
 * AI vision transcription for scanned timetables.
 *
 * A screenshot or photo of a timetable carries no text layer, so `pdf-text`
 * can only refuse. This provider sends the image to a multimodal LLM and asks
 * for the table transcribed back into the plain-text layout `parseScheduleText`
 * already understands. The LLM edits nothing and decides nothing: it only
 * transcribes what it sees, and the route still shows a confirm preview.
 *
 * Provider-agnostic on purpose: any OpenAI-compatible chat-completions
 * endpoint works (vendor SDKs avoided so swapping models never touches code).
 * Configure with `AI_VISION_BASE_URL`, `AI_VISION_API_KEY`, `AI_VISION_MODEL`.
 * With no key set the provider fails closed as `unsupported`, and the UI
 * keeps telling the class to add the slots manually.
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 60_000;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const TRANSCRIPTION_PROMPT = [
  "You are transcribing a university timetable table from the image.",
  "Transcribe every row of the table, one line per row, fields in this order:",
  "<row number> <course code> <course name> <lecturer> <class code> <day> <start time>-<end time> <period> <room> <start date> <end date>",
  "Use 24-hour times with dots (e.g. 13.00-15.00). Use Indonesian day names when the image uses them. Use codes exactly as printed, in uppercase.",
  "If a cell is empty, skip it and keep the other fields. Output ONLY the transcribed lines, no headings, no commentary.",
].join("\n");

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
};

function baseUrl(): string {
  return (
    process.env.AI_VISION_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");
}

function apiKey(): string {
  return process.env.AI_VISION_API_KEY?.trim() ?? "";
}

export const aiVisionProvider: OcrProvider = {
  name: "ai-vision",

  supports(mimeType) {
    return mimeType === "application/pdf" || IMAGE_MIME_TYPES.has(mimeType);
  },

  async extract({ bytes, mimeType }): Promise<OcrOutcome> {
    if (!apiKey()) {
      return {
        status: "unsupported",
        provider: this.name,
        reason:
          "AI reading is not configured on this deployment. Add the slots manually instead.",
      };
    }

    if (bytes.length > MAX_IMAGE_BYTES) {
      return {
        status: "failed",
        provider: this.name,
        reason: "This image is too large to read automatically.",
      };
    }

    const imageMime = IMAGE_MIME_TYPES.has(mimeType) ? mimeType : "image/jpeg";
    const dataUrl = `data:${imageMime};base64,${Buffer.from(bytes).toString("base64")}`;

    try {
      const response = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AI_VISION_MODEL?.trim() || "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: TRANSCRIPTION_PROMPT },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          status: "failed",
          provider: this.name,
          reason: "The AI reader could not process this file.",
        };
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const text = payload.choices?.[0]?.message?.content?.trim() ?? "";

      if (!text) {
        return {
          status: "unsupported",
          provider: this.name,
          reason: "No timetable rows could be read from this image.",
        };
      }

      return { status: "succeeded", provider: this.name, text };
    } catch {
      // Timeout / network / malformed response: a normal outcome, never a 500.
      return {
        status: "failed",
        provider: this.name,
        reason:
          "The AI reader timed out or is unreachable. Try again, or add the slots manually.",
      };
    }
  },
};
