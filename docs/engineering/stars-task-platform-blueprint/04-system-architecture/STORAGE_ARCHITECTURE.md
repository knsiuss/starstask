# Storage Architecture

## Existing (verified)

- Supabase Storage buckets for bytes; per-file signed URLs on download/upload.
- Writers: attachments, evidence, materials, media, avatars, exports.

## Proposed (Phase 4): Cloudflare R2

- PostgreSQL stores metadata (`storage_key`, `tenant_id`, `mime`, `size`, `owner_user_id`).
- R2 private bucket(s), object key `{universityId}/{classId}/{yyyy-mm}/{random}`.
- Server routes validate membership, then issue signed upload (PUT/POST) and signed download (GET) URLs; R2 credentials never reach the browser.
- Quota (to verify against official docs in Phase 4): 10 GB free storage (no egress charges) — verify before migrating.
- Orphan cleanup cron (list vs. metadata), deletion = object + metadata row, backup = R2 versioning/dual-write on critical paths.

Related: README.md · diagrams/10-cloudflare-r2-upload-download.mmd
