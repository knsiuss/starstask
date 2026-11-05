# Heavy Operations Audit

| Operation | Where | Sync? (verified) | Risk | Recommendation |
|---|---|---|---|---|
| Attendance recap/checklist/report exports | `attendance/exports/**` (recap/checklist/report/meeting) | Sync in-request | Vercel 10s Hobby timeout; large class = OOM | Move to DB job queue + cron runner + signed-URL download |
| Leave evidence OCR | `leave-requests/[id]/ocr` | Sync in-request | CPU + memory spikes | Background job, poll status |
| Schedule PDF parse | `lib/ocr/schedule-parse.ts`, `/schedule/import` | Sync | CPU spikes | Queue + incremental progress |
| Push delivery | `/api/push/**`, cron `notification-events` | Cron-mediated (suspected) | none observed | Keep cron; add retry/idempotency |
| File upload/download | attachments, evidence, materials, media, avatars | Sync per file | per-file signed URL overhead | R2 signed upload/download, bulk-signed for rosters |

Retention crons (`attendance-retention`, `notification-retention`) already background — pattern to copy.

Related: README.md · BACKGROUND_PROCESSING.md
