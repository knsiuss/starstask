# Security — StarsTask

## 1. Trust boundaries

| Boundary                   | Trusted?       | Control                                           |
| -------------------------- | -------------- | ------------------------------------------------- |
| Browser cookies            | No             | `auth.getUser()` verifies the token with Supabase |
| Request body / form fields | No             | Zod on the server; strict schemas                 |
| `user_id` in a payload     | No             | Never read; ownership comes from the session      |
| Uploaded filename / MIME   | No             | Extension allowlist, size cap, magic-byte check   |
| `next` redirect param      | No             | `safeRedirectPath` allowlist                      |
| Postgres RPC arguments     | No             | Type + range validation inside the function       |
| Push endpoint / keys       | No             | HTTPS + length + base64url checks; never echoed   |
| Push service response      | No             | Mapped to a short category; body never logged     |
| Service-role key           | Scheduler only | Read only by the cron route; never by pages/APIs  |

## 2. Authorization matrix

| Operation                           | anon | signed in                           | owner |
| ----------------------------------- | ---- | ----------------------------------- | ----- |
| Read published assignment           | ✗    | ✓                                   | ✓     |
| Read pending assignment             | ✗    | ✗                                   | ✓     |
| Create assignment                   | ✗    | ✓ (own `user_id`)                   | —     |
| Update assignment                   | ✗    | ✗                                   | ✓     |
| Delete assignment                   | ✗    | ✗                                   | ✓     |
| Change ownership                    | ✗    | ✗                                   | ✗     |
| Create course                       | ✗    | via RPC only                        | —     |
| Update/delete course                | ✗    | ✗                                   | ✗     |
| Read profile display metadata       | ✓    | ✓                                   | ✓     |
| Update profile                      | ✗    | own fields only                     | —     |
| Upload attachment                   | ✗    | own assignment + own prefix         | ✓     |
| Delete attachment object            | ✗    | own prefix                          | ✓     |
| Register push device                | ✗    | own endpoint only                   | —     |
| Read push devices                   | ✗    | own rows, no endpoint/keys          | —     |
| Update reminder preferences         | ✗    | own row                             | —     |
| Save/unsave assignment              | ✗    | own save, visible assignment        | —     |
| Read delivery history               | ✗    | own rows, read-only                 | —     |
| Create/mutate delivery              | ✗    | ✗                                   | —     |
| Run scheduler                       | ✗    | ✗ (bearer secret + service role)    | —     |
| Apply for a class                   | ✗    | ✓ (self only)                       | —     |
| Approve a class application         | ✗    | ✗ (platform admin only)             | —     |
| Assign a class admin                | ✗    | ✗ (platform admin only)             | —     |
| Manage own class                    | ✗    | ✗ (class admin only)                | —     |
| Submit a class assignment           | ✗    | class member only                   | —     |
| Approve/reject a submission         | ✗    | class admin only, never own         | —     |
| Unpublish/archive an assignment     | ✗    | class admin (own) or platform admin | —     |
| Restore a moderated assignment      | ✗    | ✗ (platform admin only)             | —     |
| Read audit records                  | ✗    | class admin (own) or platform admin | —     |
| Read invitation token hash          | ✗    | ✗ (not granted to any client)       | —     |
| Declare a profile position          | ✗    | own claim only; grants nothing      | —     |
| Create/edit a verification request  | ✗    | own, while editable                 | —     |
| Upload/remove verification evidence | ✗    | own editable request + own prefix   | —     |
| Read verification evidence          | ✗    | own, or platform admin if submitted | —     |
| Decide a verification request       | ✗    | ✗ (platform admin only, never own)  | —     |
| Revoke verification-granted access  | ✗    | ✗ (platform admin only)             | —     |

Class roles and their full capability table are in
[docs/CLASSES.md](./CLASSES.md#2-roles-and-permissions).

Enforcement is duplicated on purpose: the server filters by `user_id`, and RLS applies the
same predicate. Either layer alone would still be correct; together they survive a bug in
the other.

## 3. RLS details

- `alter table ... enable row level security` on `profiles`, `courses`, `assignments`,
  `assignment_attachments`, `rate_limits`, the four push tables, and the five leave
  tables (`leave_requests`, `leave_request_evidence`, `leave_request_history`,
  `leave_request_forwardings`, `leave_request_forwarding_items`).
- Column grants narrow what a role can touch: `assignments` INSERT excludes `status`;
  UPDATE excludes `user_id` and `status`; `profiles` UPDATE excludes `id`.
  `push_subscriptions` SELECT excludes `endpoint`, `p256dh`, and `auth`;
  `notification_deliveries` has no client write grant at all.
- `assignments_owner_immutable` trigger raises `42501` if `user_id` changes, covering any
  path that bypasses column grants.
- `list_assignments` is `security invoker`, so its `status = 'published'` filter is
  defence in depth, not the only guard.
- `create_or_get_course` is `security definer` but checks `auth.uid() is not null` and is
  granted only to `authenticated`.
- `register_push_subscription` is `security definer`, derives the user from `auth.uid()`,
  and returns `null` instead of transferring an endpoint owned by another account.
- `delete_push_subscription` is `security definer` and deletes only the row whose
  `user_id` matches `auth.uid()`, so unsubscribing by endpoint never requires granting
  clients SELECT on `endpoint`.
- `claim_notification_deliveries`, `list_reminder_audience`, and
  `complete_notification_delivery` are `security definer` and granted only to
  `service_role`.
- `handle_new_user` and `consume_rate_limit` run with `search_path` pinned.
- Class state changes run in `SECURITY DEFINER` functions that derive the actor from
  `auth.uid()` and re-check the role. `decide_class_application` and `assign_class_admin`
  require `is_platform_admin()`; class metadata, invitations, removal, and review require
  `can_manage_class(class_id)`; submission requires membership.
- The platform console's read models (`list_platform_users`, `list_platform_classes`,
  `get_platform_admin_overview`) are `SECURITY DEFINER`, pin `search_path`, re-check
  `is_platform_admin()`, revoke `PUBLIC` execute, and return only safe profile and
  aggregate fields. They expose no emails, legal names, student IDs, or submissions.
- `platform_admins` has no client grant at all. There is no API or UI path to grant it.
- `classes`, `class_members`, `class_admins`, and `class_invitations` grant only `SELECT`
  to clients; every write goes through a function. `class_invitations` never grants
  `token_hash`.
- Reviewers can read pending attachments through
  `assignment_attachments_reviewer_read` and the matching storage policy, scoped to their
  own class (or platform admin).
- Verification state changes run in `SECURITY DEFINER` functions that derive the actor
  from `auth.uid()`. Student functions require ownership and an editable status;
  `decide_class_verification` and `revoke_verified_class_admin` require
  `is_platform_admin()`. Self-review is rejected by the function **and** by a table
  constraint. The three verification tables grant only `SELECT`, hide `reviewed_by` and
  `actor_id`, and never show an unsubmitted draft to a reviewer.
- `profiles.declared_position` is absent from the client SELECT grant and is never read by
  an authorization check. It is changed only through `set_my_declared_position()`.

## 4. Storage

- Bucket `assignment-attachments` is private; there is no public URL path.
- Keys embed the owner and assignment ids: `{uid}/{assignment_id}/{uuid}-{name}`.
- Read: signed-in owner, a signed-in reader of a published assignment, or a reviewer of that assignment's class.
- Insert: owner prefix **and** assignment ownership.
- Delete: owner prefix only (so cleanup works after the row is gone).
- Downloads are 15-minute signed URLs generated server-side; the URL is not stored.
- Bucket-level `file_size_limit` and `allowed_mime_types` back up application checks.

Leave evidence (`leave-evidence` bucket) is stricter:

- Private, with the same bucket-level 10 MB limit and `pdf/jpeg/png` allow-list.
- Keys are `{uid}/{request_id}/{uuid}-{name}`, so an object belongs to exactly one
  request and one student; the storage policy derives the request from the path
  prefix and re-checks reviewer rights on it.
- Downloads use 5-minute signed URLs (shorter than assignments because the files
  may contain medical information).
- `storage_path` is `UNIQUE`, and objects are never exposed in CSV/PDF/ZIP
  exports — reports carry no URLs, paths, or credentials.

Verification evidence (`verification-evidence` bucket) follows the same pattern:

- Private, 10 MB limit, `application/pdf`, `image/jpeg`, `image/png`.
- Keys are `{uid}/{request_id}/{uuid}-{name}`; the policy derives the request from the
  key and re-checks visibility or editability on it, rather than trusting a path segment.
- Read: owner prefix, or a platform admin for a submitted request. Insert: owner prefix
  **and** an editable request. Delete: owner prefix only, for cleanup.
- Downloads use 5-minute signed URLs. Paths never appear in API responses, logs, or
  notifications, and are not included in any export.

## 5. Input validation

- Zod schemas in `packages/contracts` are the single source for both the form and the
  server. `assignmentUpdateSchema` is `.strict()`, so unknown keys fail.
- Deadlines must carry an explicit UTC offset; a bare `datetime-local` string is rejected
  so the server never guesses a timezone.
- Reference URLs must be absolute `http(s)`; `javascript:`, `data:`, and protocol-relative
  values are rejected at write time and re-checked at render time.
- Search parameters are coerced and bounded (`pageSize ≤ 24`, `page ≤ 500`).
- Push endpoints must be `https:`, use a DNS hostname (no IP literal, `localhost`, or
  credentials), use port 443, and stay under 2048 characters. `p256dh`/`auth` must be
  base64url and within length bounds.
- Notification time zones must be valid IANA zones; the default is `Asia/Jakarta`.
- Saved assignments take a UUID only; the insert policy also requires the assignment to be
  visible to the caller.
- Postgres constraints duplicate the important rules (title/description length, tag count,
  reference array shape, status/type enums, file size, MIME type, push key lengths,
  delivery status/type enums).

## 6. File validation

1. Extension must be one of `pdf, docx, pptx, xlsx, png, jpg, jpeg`.
2. Size must be > 0 and ≤ 10 MB.
3. First bytes must match the expected signature:
   - PDF `%PDF-`
   - OOXML `PK\x03\x04` / `PK\x05\x06`
   - PNG `\x89PNG\r\n\x1a\n`
   - JPEG `FF D8 FF`
4. The stored name is sanitized (path components stripped, unsafe characters replaced)
   and prefixed with a UUID, so uploads cannot overwrite each other.
5. At most three files per assignment, enforced before upload and again by count check.

Client-supplied MIME types are ignored; the MIME type is derived from the validated
extension.

Leave evidence follows the same discipline with a tighter allow-list:

1. Extension must be one of `pdf, jpg, jpeg, png`, size > 0 and ≤ 10 MB.
2. Magic bytes are checked against the PDF/PNG/JPEG signatures, not the declared type.
3. The storage row is registered through `add_leave_request_evidence`, which verifies
   the object key belongs to the caller's own `{uid}/{request_id}/` prefix; if the
   RPC fails, the just-uploaded object is deleted so no orphan is left readable.
4. At most ten files per request, enforced client-side and again at registration.

Verification evidence reuses the same signature checks with a `pdf/jpg/jpeg/png`
allow-list:

1. Extension, size (> 0, ≤ 10 MB), and magic bytes are checked before upload; the
   declared MIME type is ignored.
2. `add_class_verification_evidence` re-checks the MIME type, size, filename length, the
   `{uid}/{request_id}/` prefix, and the five-file limit. If it rejects the row, the
   uploaded object is deleted immediately.
3. Passing these checks proves only that the file is a readable PDF or image. It is not
   evidence of authenticity, and the UI and documentation say so.

## 7. Abuse prevention

- Rate limits are distributed by default (Postgres counter) and can be upgraded to Upstash.
  In-memory limiting exists only for local development without Supabase.
- IPs are hashed with `RATE_LIMIT_SALT` before being used as a counter key; raw IPs are
  never stored.
- A hidden `website` honeypot rejects naive bots.
- Request bodies are capped (34 MB multipart, 64 KB JSON, 8 KB push subscription, 4 KB
  preferences).
- Push endpoints are rate-limited per user (subscribe 30/hour, unsubscribe 60/hour,
  preferences 60/hour, saves 120/hour).
- Limiter outages fail open and are logged; the trade-off is documented in code.

## 8. Headers and rendering

Set in `next.config.ts` for every route:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; …
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

`poweredByHeader` is disabled. React escapes all interpolated text, so assignment
descriptions render as text, never HTML. Reference links are validated before becoming
`href`s and open with `rel="noopener noreferrer"`.

Known gap: the CSP allows inline scripts because Next.js hydration needs them. A
nonce-based policy is a documented follow-up.

## 9. Secrets and logging

- Only the publishable key reaches the browser. `scripts/check-env.mjs` fails the build if
  a `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_VAPID_PRIVATE_KEY` ever exists.
- The public VAPID key is passed to the settings page as a server prop. The private key is
  read only by the scheduler module and is never logged or serialized into a response.
- `SUPABASE_SERVICE_ROLE_KEY` is imported only by `src/lib/push/store.ts` through the
  admin client, and only the cron route constructs that store.
- `CRON_SECRET` is compared with `crypto.timingSafeEqual`; a missing secret disables the
  endpoint instead of leaving it open.
- Push endpoints, `p256dh`/`auth`, payloads, and provider response bodies are never logged.
  The scheduler logs aggregate counters and short error categories only.
- Errors are logged with a code or name only — no cookies, tokens, bodies, emails, or
  storage paths.
- Public API responses omit `user_id` and `storage_path`; push APIs omit endpoints and keys.
- Leave-request notifications never contain the explanation, reason category, OCR text,
  document contents, or an evidence link — only the reference, the student display name,
  and the leave dates. OCR raw text is stored in `ocr_result` for the student's own
  review and is never included in list responses, logs, or exports.
- `.env*` files are gitignored except `.env.example` (placeholders only).
- Gitleaks runs on every commit through a `pre-commit` hook and again in CI, so a
  credential pasted into a source, docs, or fixture file is rejected before review.

## 10. Verified vs unverified

**Verified locally**

- 501 unit tests across 32 files, including redirect sanitization, URL safety, schema
  strictness, file signature checks, timezone boundaries, push capability detection, iOS
  guidance, service-worker registration, permission states, subscription validation,
  reminder windows, dedupe at the scheduler boundary, retries, expiry handling, deadline
  changes, cron authentication, click destinations, and the verification contracts and
  evidence checks listed below.
- `tsc`, ESLint, and `next build` pass.
- 8 Playwright tests pass against the unconfigured build (public pages, 404, robots,
  sitemap, skip link, protected-route handling).
- Verification contracts and evidence checks are covered by dedicated unit tests:
  status/decision schemas, strict rejection of unknown fields, magic-byte validation,
  filename sanitization, storage-key scoping, and notification path allowlisting.

**Not verified**

- RLS policies against a live database (`tests/integration/rls.test.ts` is written but was
  not run in this environment; it can create and delete rows, so it was not pointed at an
  unknown project). This includes all four push tables and the verification tables.
- The class verification migration was never applied to Postgres. Its functions,
  constraints, grants, and storage policies have not been executed.
- Storage policy behaviour with real objects, including the verification bucket.
- Live OAuth.
- Real push delivery: no VAPID keys, no deployed scheduler, no device test.
- iOS/iPadOS Home Screen push behaviour on a physical device.
- Production headers at the edge (Vercel applies `next.config.ts` headers, but no
  deployment was performed).
- Any cron schedule actually firing.

## 11. Residual risks

| Risk                                                  | Mitigation / status                                                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious file with a valid signature                 | No antivirus/scanning integration. Documented.                                                                                                                                  |
| Orphaned storage object if cleanup fails              | Logged; no scheduled sweeper.                                                                                                                                                   |
| Course catalogue pollution by any signed-in user      | Any authenticated user can create courses through the RPC. Intended for MVP.                                                                                                    |
| No moderation queue                                   | `pending` exists but is unreachable from the UI.                                                                                                                                |
| Inline-script CSP                                     | Required by Next.js hydration; nonce policy is future work.                                                                                                                     |
| Rate limiter fails open                               | Availability trade-off; alert on the logged marker.                                                                                                                             |
| Missing `RATE_LIMIT_SALT`                             | Falls back to a fixed development salt, so IP hashes become predictable. `pnpm check:env` fails on this, but the app still starts.                                              |
| Service-role key in the cron runtime                  | The only privileged path. It is read by the scheduler module alone, its RPCs are `service_role`-only, and the route requires a timing-safe bearer token. Rotate on suspicion.   |
| Push endpoint leak                                    | Endpoints and key material are excluded from client SELECT grants and from logs/responses. A database-level reader could still see them.                                        |
| Stale reminder after a deadline change                | Each claim is re-validated against the current deadline and assignment status; mismatches are marked `skipped`, never sent.                                                     |
| Reminder delivered after the deadline                 | Messages use `TTL: 3600` and a one-hour grace window, so a long-held push cannot arrive much after the deadline.                                                                |
| Scheduler never runs                                  | No cron source is configured; on Vercel Hobby the 10-minute schedule needs Pro. Documented, not silently assumed.                                                               |
| Delivery ledger growth                                | No automatic retention job; rows are small and contain no payloads. Manual cleanup SQL is documented.                                                                           |
| Leave evidence left readable after removal            | Removal is a soft delete plus an immediate object deletion; if the object deletion fails it is logged, and the storage policy already blocks reads for removed evidence owners. |
| Forged but readable verification evidence             | Validation proves file type only. Approval is a human decision; there is no authenticity detector, by design.                                                                   |
| Reviewer approves a class the student does not attend | The reviewer sees the claim and evidence; the schema cannot prove attendance.                                                                                                   |
| Verified request after access is revoked              | The status stays `verified` for history; the UI reads the `class_admins` row to show current access, and revocation refuses to remove the last class admin.                     |
| Verification evidence retained after a decision       | Kept for audit, accessible only through policy and five-minute links; never public and never in notifications.                                                                  |
| OCR mis-read treated as fact                          | OCR is advisory only: extracted values are shown with provenance and nothing is applied or forwarded without the student confirming each field.                                 |
