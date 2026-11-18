import { Receiver } from "@upstash/qstash";

import { apiError, apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  getExportJobForWorker,
  markExportJobDone,
  markExportJobFailed,
} from "@/lib/db/export-jobs";
import { runExportJob, storeExportResult } from "@/lib/queue/export-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * QStash worker: generates one queued export.
 *
 * Idempotent end to end — finished jobs return success immediately, so
 * QStash retries (and the failure callback) are safe. The request must carry
 * a valid Upstash signature; anything else is rejected before any work.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();

  if (!currentKey) {
    return apiError(503, "not_configured", "Worker is not configured.");
  }

  const signature = request.headers.get("upstash-signature");

  if (!signature) {
    return apiError(401, "unauthorized", "Missing signature.");
  }

  let valid = false;

  try {
    const receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: nextKey,
    });
    valid = await receiver.verify({
      signature,
      body: rawBody,
      url: request.url,
    });
  } catch {
    valid = false;
  }

  if (!valid) {
    return apiError(401, "unauthorized", "Invalid signature.");
  }

  let jobId: string;

  try {
    jobId = (JSON.parse(rawBody) as { jobId?: string }).jobId ?? "";
  } catch {
    return apiError(400, "invalid_body", "Invalid job payload.");
  }

  if (!jobId) {
    return apiError(400, "invalid_body", "Missing jobId.");
  }

  const job = await getExportJobForWorker(jobId);

  if (!job) {
    return apiSuccess({ ok: true, deduplicated: true });
  }

  try {
    const result = await runExportJob(job);
    const resultPath = await storeExportResult(job, result);
    await markExportJobDone(job.id, resultPath);

    return apiSuccess({ ok: true });
  } catch (error) {
    // Only the sanitized category is persisted: detailed errors (and any
    // storage internals) never reach user-visible status rows.
    const category =
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "export_failed";
    await markExportJobFailed(job.id, category);

    return handleRouteError(error);
  }
}
