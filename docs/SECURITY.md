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

| Operation                      | anon | signed in                           | owner |
| ------------------------------ | ---- | ----------------------------------- | ----- |
| Read published assignment      | ✓    | ✓                                   | ✓     |
| Read pending assignment        | ✗    | ✗                                   | ✓     |
| Create assignment              | ✗    | ✓ (own `user_id`)                   | —     |
| Update assignment              | ✗    | ✗                                   | ✓     |
| Delete assignment              | ✗    | ✗                                   | ✓     |
| Change ownership               | ✗    | ✗                                   | ✗     |
| Create course                  | ✗    | via RPC only                        | —     |
| Update/delete course           | ✗    | ✗                                   | ✗     |
| Read profile display metadata  | ✓    | ✓                                   | ✓     |
| Update profile                 | ✗    | own fields only                     | —     |
| Upload attachment              | ✗    | own assignment + own prefix         | ✓     |
| Delete attachment object       | ✗    | own prefix                          | ✓     |
| Register push device           | ✗    | own endpoint only                   | —     |
| Read push devices              | ✗    | own rows, no endpoint/keys          | —     |
| Update reminder preferences    | ✗    | own row                             | —     |
| Save/unsave assignment         | ✗    | own save, visible assignment        | —     |
| Read delivery history          | ✗    | own rows, read-only                 | —     |
| Create/mutate delivery         | ✗    | ✗                                   | —     |
| Run scheduler                  | ✗    | ✗ (bearer secret + service role)    | —     |
| Apply for a class              | ✗    | ✓ (self only)                       | —     |
| Approve a class application    | ✗    | ✗ (platform admin only)             | —     |
| Assign a class admin           | ✗    | ✗ (platform admin only)             | —     |
| Manage own class               | ✗    | ✗ (class admin only)                | —     |
| Submit a class assignment      | ✗    | class member only                   | —     |
| Approve/reject a submission    | ✗    | class admin only, never own         | —     |     | Unpublish/archive a published assignment | ✗   | class admin (own) or platform admin | —   |
| Restore a moderated assignment | ✗    | ✗ (platform admin only)             | —     |
| Read audit records             | ✗    | class admin (own) or platform admin | —     |
| Read invitation token hash     | ✗    | ✗ (not granted to any client)       | —     |

Class roles and their full capability table are in
[docs/CLASSES.md](./CLASSES.md#2-roles-and-permissions).

Enforcement is duplicated on purpose: the server filters by `user_id`, and RLS applies the
same predicate. Either layer alone would still be correct; together they survive a bug in
the other.

## 3. RLS details

- `alter table ... enable row level security` on `profiles`, `courses`, `assignments`,
  `assignment_attachments`, `rate_limits`, and the four push tables.
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
- `claim_notification_deliveries`, `list_reminder_audience`, and
  `complete_notification_delivery` are `security definer` and granted only to
  `service_role`.
- `handle_new_user` and `consume_rate_limit` run with `search_path` pinned.
- Class state changes run in `SECURITY DEFINER` functions that derive the actor from
  `auth.uid()` and re-check the role. `decide_class_application` and `assign_class_admin`
  require `is_platform_admin()`; class metadata, invitations, removal, and review require
  `can_manage_class(class_id)`; submission requires membership.
- `platform_admins` has no client grant at all. There is no API or UI path to grant it.
- `classes`, `class_members`, `class_admins`, and `class_invitations` grant only `SELECT`
  to clients; every write goes through a function. `class_invitations` never grants
  `token_hash`.
- Reviewers can read pending attachments through
  `assignment_attachments_reviewer_read` and the matching storage policy, scoped to their
  own class (or platform admin).

## 4. Storage

- Bucket `assignment-attachments` is private; there is no public URL path.
- Keys embed the owner and assignment ids: `{uid}/{assignment_id}/{uuid}-{name}`.
- Read: owner prefix, a published assignment, or a reviewer of that assignment's class.
- Insert: owner prefix **and** assignment ownership.
- Delete: owner prefix only (so cleanup works after the row is gone).
- Downloads are 15-minute signed URLs generated server-side; the URL is not stored.
- Bucket-level `file_size_limit` and `allowed_mime_types` back up application checks.

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
- `.env*` files are gitignored except `.env.example` (placeholders only).
- Gitleaks runs on every commit through a `pre-commit` hook and again in CI, so a
  credential pasted into a source, docs, or fixture file is rejected before review.

## 10. Verified vs unverified

**Verified locally**

- 190 unit tests across 12 files, including redirect sanitization, URL safety, schema
  strictness, file signature checks, timezone boundaries, push capability detection, iOS
  guidance, service-worker registration, permission states, subscription validation,
  reminder windows, dedupe at the scheduler boundary, retries, expiry handling, deadline
  changes, cron authentication, and click destinations.
- `tsc`, ESLint, and `next build` pass.
- 8 Playwright tests pass against the unconfigured build (public pages, 404, robots,
  sitemap, skip link, protected-route handling).

**Not verified**

- RLS policies against a live database (`tests/integration/rls.test.ts` is written but was
  never executed — no project exists). This includes all four push tables.
- Storage policy behaviour with real objects.
- Live OAuth.
- Real push delivery: no VAPID keys, no deployed scheduler, no device test.
- iOS/iPadOS Home Screen push behaviour on a physical device.
- Production headers at the edge (Vercel applies `next.config.ts` headers, but no
  deployment was performed).
- Any cron schedule actually firing.

## 11. Residual risks

| Risk                                             | Mitigation / status                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious file with a valid signature            | No antivirus/scanning integration. Documented.                                                                                                                                |
| Orphaned storage object if cleanup fails         | Logged; no scheduled sweeper.                                                                                                                                                 |
| Course catalogue pollution by any signed-in user | Any authenticated user can create courses through the RPC. Intended for MVP.                                                                                                  |
| No moderation queue                              | `pending` exists but is unreachable from the UI.                                                                                                                              |
| Inline-script CSP                                | Required by Next.js hydration; nonce policy is future work.                                                                                                                   |
| Rate limiter fails open                          | Availability trade-off; alert on the logged marker.                                                                                                                           |
| Missing `RATE_LIMIT_SALT`                        | Falls back to a fixed development salt, so IP hashes become predictable. `pnpm check:env` fails on this, but the app still starts.                                            |
| Service-role key in the cron runtime             | The only privileged path. It is read by the scheduler module alone, its RPCs are `service_role`-only, and the route requires a timing-safe bearer token. Rotate on suspicion. |
| Push endpoint leak                               | Endpoints and key material are excluded from client SELECT grants and from logs/responses. A database-level reader could still see them.                                      |
| Stale reminder after a deadline change           | Each claim is re-validated against the current deadline and assignment status; mismatches are marked `skipped`, never sent.                                                   |
| Reminder delivered after the deadline            | Messages use `TTL: 3600` and a one-hour grace window, so a long-held push cannot arrive much after the deadline.                                                              |
| Scheduler never runs                             | No cron source is configured; on Vercel Hobby the 10-minute schedule needs Pro. Documented, not silently assumed.                                                             |
| Delivery ledger growth                           | No automatic retention job; rows are small and contain no payloads. Manual cleanup SQL is documented.                                                                         |
