# 20 — Domain N: Materials & Storage

> **Status:** DRAFT. **VERIFIED** = repo evidence (migrations + `supabase/config.toml`).

## 20.1 Actual buckets (VERIFIED from migrations — 5 buckets)

| Bucket `id`              | Visibility                     | Size limit          | Mime allowlist                   | Created by                                                     |
| ------------------------ | ------------------------------ | ------------------- | -------------------------------- | -------------------------------------------------------------- |
| `assignment-attachments` | **private** (`public = FALSE`) | 10 MiB (10,485,760) | pdf, docx, pptx, xlsx, png, jpeg | `20261029000400_storage.sql` (+ `supabase/config.toml` mirror) |
| `leave-evidence`         | **private**                    | 10 MiB              | pdf, jpeg, png                   | `20261029002400_leave_rls.sql`                                 |
| `verification-evidence`  | **private**                    | 10 MiB              | pdf, jpeg, png                   | `20261029002600_class_verification.sql`                        |
| `avatars`                | **public** (`public = TRUE`)   | 2 MiB (2,097,152)   | png, jpeg                        | `20261029002700_profile_onboarding.sql`                        |
| `class-media`            | **public**                     | 4 MiB (4,194,304)   | png, jpeg                        | `20261102100000_class_media.sql`                               |

- **UNRESOLVED (new):** whether `class-media` public visibility is intentional (class photos assumed public) — RECOMMENDED review in Phase 5A (public bucket + class membership data = privacy question).

## 20.2 Object naming + metadata

- **VERIFIED convention (assignments):** `{owner_id}/{assignment_id}/{uuid}-{safe_filename}` (`20261029000400_storage.sql` header comment). Prefix = owner uuid; second segment = assignment uuid; filename sanitized.
- **UNRESOLVED (new):** naming conventions for leave/verification evidence, avatars, class-media objects were not extracted in this pass — Phase 5A must read each bucket's `storage.objects` policies to confirm per-bucket prefixes.
- Row metadata: `assignment_attachments` (`assignment_id` + `owner_id`, renamed `20261103130000`), `course_materials` target adds `storage_path`/`mime`/`size_bytes`/`uploaded_by` (see `26`). No checksum column was evidenced — **UNRESOLVED (new):** whether `storage.objects.metadata` carries hashes.

## 20.3 Table RLS does NOT secure storage (VERIFIED warning)

- **Storage security is independent of table RLS.** `storage.objects` has its **own policies** (VERIFIED `20261029000400`):
  - `assignment_attachments_storage_read`: `SELECT TO anon, authenticated USING (bucket_id='assignment-attachments' AND (uid = foldername(name)[1] OR published-assignment EXISTS))`.
  - `..._insert`: `TO authenticated WITH CHECK (bucket_id AND uid = foldername(name)[1] AND assignment owner = uid)`.
  - `..._delete`: `TO authenticated USING (bucket_id AND uid = foldername(name)[1])`.
  - Leave/verification buckets have parallel read/insert/delete policies (`20261029002400`, `20261029002600` VERIFIED).
- **Consequence:** fixing/removing a table RLS policy does NOT open or close storage access, and vice versa. Any tenant-migration must touch **both** layers.

## 20.4 Visibility + upload/download auth

- Private buckets: uploads = `authenticated` + owner-path + parent-row ownership (VERIFIED above); downloads = short-lived **signed URLs** generated server-side, never public access (VERIFIED header comment: "Public downloads are served through short-lived signed URLs generated on the server, never through public bucket access").
- Public buckets (`avatars`, `class-media`): direct public read is possible by design — no signed-URL needed. Upload auth for these buckets was not extracted (UNRESOLVED; Phase 5A).
- AGENTS.md §7.1 (VERIFIED rule): short-lived signed URLs, scoped to the authorized user; never expose private objects via public URLs.

## 20.5 Tenant isolation (RECOMMENDED — target)

- Current state: **no tenant prefix** (owner-path only; no `university_id` segment) — VERIFIED absence.
- RECOMMENDED: object keys become `{university_id}/{target_id}/{uuid}-{safe_filename}` and `storage.objects` policies add a tenant check (caller has an active `student_identities` row in that university, or `is_platform_admin()`). Backfill: dual-read old + new keys during expand-contract.
- Public buckets need the same university-prefix treatment unless product confirms they are intentionally global (UNRESOLVED with §20.1).

## 20.6 Deletion, metadata, retention, orphan detection

| Concern          | Current state                                                                                                                                                       | RECOMMENDED                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deletion         | `assignment_attachments_storage_delete` is owner-path only (VERIFIED)                                                                                               | Unlink row → delete object in the same RPC transaction; evidence files retained while cited by history/audit (see `07` §7.5) never hard-deleted while cited            |
| Metadata         | Mime + size enforced at bucket level (VERIFIED)                                                                                                                     | Mirror `mime`/`size_bytes` into row metadata for listing without HEAD calls                                                                                            |
| Retention        | API cron `attendance-retention`/`notification-retention` exist (VERIFIED routes) but **no storage-lifecycle migration was found** — storage retention is UNRESOLVED | Adopt the retention matrix in `33` (evidence while cited + 1y; attachments per assignment lifecycle) and implement as API-cron sweeps (no `pg_cron` — VERIFIED absent) |
| Orphan detection | **No orphan-cleanup code evidenced** (UNRESOLVED)                                                                                                                   | Scheduled reconciliation: list objects, anti-join to link rows (`assignment_attachments`/`course_materials`/evidence tables), log + delete (dry-run mode first)        |

## 20.7 Target tables (summary)

- `course_materials` KEEP + MODIFY (`offering_id`, `university_id`, `storage_path`, path prefix).
- `assignment_attachments` KEEP + MODIFY (`university_id` backfill).
- No unified `files` table (RECOMMENDED: keep per-domain link tables for FK integrity).

**Cross-refs:** `06`, `16` (attachments), `23` (§23.5 storage), `24` (§24.5), `26` §26.1, `33` (retention), `36` items 10/14.
