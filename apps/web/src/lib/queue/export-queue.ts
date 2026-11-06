"server-only";

import { Client } from "@upstash/qstash";

import { getSiteUrl } from "@/lib/env/public";

let client: Client | null | undefined;

function getClient(): Client | null {
  if (client !== undefined) {
    return client;
  }

  const token = process.env.QSTASH_TOKEN?.trim();

  if (!token) {
    client = null;
    return client;
  }

  client = new Client({ token });
  return client;
}

/** Async export pipeline is available only when QStash is configured. */
export function isAsyncExportConfigured(): boolean {
  return getClient() !== null;
}

/**
 * Queues one export job with QStash. Retries are bounded by QStash's
 * retry policy; the worker itself is idempotent, so a duplicated delivery
 * is safe.
 */
export async function enqueueExport(jobId: string): Promise<void> {
  const qstash = getClient();

  if (!qstash) {
    throw new Error("Async exports are not configured.");
  }

  await qstash.publishJSON({
    url: `${getSiteUrl()}/api/worker/export`,
    body: { jobId },
    retries: 3,
    failureCallback: `${getSiteUrl()}/api/worker/export`,
  });
}
