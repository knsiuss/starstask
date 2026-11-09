"server-only";

/**
 * Background queue (Upstash QStash, free tier).
 * - Push dispatch, OCR, export Excel, plugin sync UNPAM
 * - Retry 3x exponential, DLQ via failed topic
 * Env: QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY
 * Fallback: after() in-process kalau QStash belum dikonfigurasi.
 */

export function isQStashConfigured(): boolean {
  return Boolean(process.env.QSTASH_TOKEN?.trim());
}

export async function enqueueJob(
  url: string,
  payload: Record<string, unknown>,
): Promise<{ queued: boolean }> {
  if (!isQStashConfigured()) return { queued: false };
  const { Client } = await import("@upstash/qstash");
  const client = new Client({ token: process.env.QSTASH_TOKEN });
  await client.publishJSON({
    url,
    body: payload,
    retries: 3,
    deduplicationId: `${payload.dedupeKey ?? url}-${Date.now()}`,
  });
  return { queued: true };
}
