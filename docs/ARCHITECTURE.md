# Architecture — StarsTask

## 1. Shape

```
Browser
  │  HTML / RSC payload
  ▼
Next.js 16 (Vercel)
  ├─ src/proxy.ts ──────────────► Supabase Auth (session refresh, cookie mirror)
  ├─ Server Components ────────► src/lib/db (user-scoped Supabase client) ──► Postgres + RLS
  ├─ Route Handlers ───────────► src/features (validation, uploads, rollback)
  ├─ Client Components ────────► /api/* and Supabase Auth (OAuth start)
  └─ Cron Route ───────────────► src/lib/push (claim + web-push) ──► push services
                                         │
                                         └─► Supabase Storage (private bucket, signed URLs)
```

There is no separate backend service. Next.js Route Handlers are the write boundary;
Server Components read directly through the data-access layer. The only privileged runtime
path is the cron scheduler, which uses a service-role client to claim delivery rows across
users.

## 2. Layers

| Layer                 | Location                                                            | Rule                                                                  |
| --------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Contracts             | `packages/contracts`                                                | Zod schemas + constants. No React, no DB.                             |
| Shared helpers        | `packages/shared`                                                   | Pure formatting and Asia/Jakarta deadline logic.                      |
| Presentation          | `apps/web/src/app`, `src/components`                                | Rendering only; no SQL.                                               |
| Feature orchestration | `src/features/assignments`, `src/features/classes`                  | Multi-step operations (DB row → upload → attachment rows → rollback). |
| Push orchestration    | `src/lib/push`                                                      | Reminder planning, payloads, sender, scheduler, capability detection. |
| Data access           | `src/lib/db`                                                        | Every Supabase query lives here.                                      |
| Platform              | `src/lib/supabase`                                                  | Client factories (`server`, `client`, `proxy`).                       |
| Cross-cutting         | `src/lib/api`, `src/lib/security`, `src/lib/storage`, `src/lib/env` | Errors, rate limits, redirects, file validation, signed URLs.         |

Server Components never import the browser client; client components never import
`server-only` modules. `server-only` is imported by the data-access, storage, auth, and
rate-limit modules so a mistaken client import fails at build time.

## 3. Read path

### Public listing

1. `/assignments` parses `searchParams` with `listAssignmentsQuerySchema`.
2. `listAssignments()` calls the `list_assignments` RPC with `p_limit`/`p_offset`.
3. The RPC filters `status = 'published'`, joins `courses` and `profiles`, counts
   attachments, and returns `total_count` via a window function.
4. Results render through `AssignmentList` → `AssignmentCard`.

The RPC is `security invoker`, so RLS still applies: a bug in the `where` clause cannot
expose a pending row to an anonymous visitor.

### Detail

1. `assignmentIdSchema` validates the UUID; invalid input goes to `notFound()`.
2. `getAssignmentDetail()` embeds `courses` and `assignment_attachments`.
3. The page fetches the session, compares `user_id` for owner-only actions, and asks
   `getAttachmentViews()` for 15-minute signed URLs.
4. `generateMetadata` produces canonical + OG tags; pending rows are `noindex`.

## 4. Write path (create with attachments)

```
POST /api/assignments (multipart)
  ├─ session?           no → 401
  ├─ rate limit         10/hour per user → 429
  ├─ content-length     > 34 MB → 413
  ├─ honeypot           filled → 400
  ├─ Zod parse           → 422 with fieldErrors
  ├─ files ≤ 3           → 400
  ├─ validate bytes      extension + size + magic signature → 400
  ├─ create_or_get_course (security definer, authenticated only)
  ├─ insert assignment   (user_id from session, never from the body)
  ├─ upload each file    {user_id}/{assignment_id}/{uuid}-{name}
  ├─ insert attachment rows
  └─ on any failure: remove uploaded objects, delete the assignment row, return 500
```

Why this order: the storage policy requires an assignment row that the caller owns, so
the row must exist before the upload. Cleanup runs in reverse order so no orphan file or
half-created record survives a failure.

Delete is the mirror image: delete the DB row first (cascades attachment rows), then
remove storage objects. The storage delete policy only checks the owner prefix, so it
still works after the assignment row is gone.

## 5. Class and moderation path

```text
Class application     apply_for_class (pending)
      ↓               platform admin: decide_class_application
Approved class        classes + class_members (+ optional class_admins)
      ↓               class admin: create_class_invitation
token hash stored     accept_class_invitation -> membership only
      ↓               member: submit_class_assignment
pending_review        attachments uploaded by the submitter
      ↓               class admin: review_class_assignment
published             appears in list_assignments and public class pages
      ↓               moderate_assignment / remove_assignment_attachment
unpublished/archived  hidden again
```

Each arrow is a `SECURITY DEFINER` function that derives the actor from
`auth.uid()`, checks the role, and writes the state change, the history row, the
audit entry, and any notification event in one transaction. Route handlers only
parse and validate input; server components read through `src/lib/db/classes.ts`
and `src/lib/db/class-submissions.ts`.

The UI is layered the same way:

- `(site)` holds public discovery: `/classes`, `/classes/[slug]`, `/invite/[token]`.
- `(workspace)` holds `/dashboard`, `/dashboard/applications`, member class pages,
  class admin review and management pages, and `/admin`.
- Client components own only mutation forms (`components/forms`, `components/classes`,
  `components/review`, `components/admin`). They call the JSON/multipart APIs and never
  import a server-only module.

## 6. Push reminder path

```
POST /api/push/subscriptions
  ├─ session?                  no → 401
  ├─ push configured?          no → 503
  ├─ rate limit                30/hour per user
  ├─ Zod parse                 → 422
  ├─ register_push_subscription (user from session, ownership never transferred)
  └─ 201 { id } | 409 when another account owns the endpoint

GET /api/cron/deadline-reminders        (Bearer CRON_SECRET)
  ├─ list candidates           published, deadline in the next 25h, limit 200
  ├─ list_reminder_audience    owners + savers, opted in, active device
  ├─ plan 24h/3h rows          insert with unique-key dedupe
  ├─ claim_notification_deliveries   FOR UPDATE SKIP LOCKED
  ├─ re-validate + send        every active device, TTL 1h
  └─ complete_notification_delivery  sent | pending | failed | skipped
```

The browser only ever receives the public VAPID key. The private key and the service-role
key stay in the scheduler module. The service worker at `/sw.js` has no `fetch` handler and
no cache, so authenticated pages cannot be served from a stale cache. Full behavior,
windows, retry policy, and deployment options: `docs/PUSH_NOTIFICATIONS.md`.

## 7. Authentication path

1. `/login` validates `next` with `safeRedirectPath()`.
2. The browser client calls `signInWithOAuth({ provider: "google" })` with
   `redirectTo = {origin}/auth/callback?next=...`.
3. Google → Supabase `/auth/v1/callback` → `/auth/callback?code=...`.
4. The callback rate-limits, exchanges the code for a session (PKCE verifier cookie),
   confirms the profile exists, and redirects to the sanitized `next`.
5. `src/proxy.ts` refreshes the session on every matched request and mirrors cookies.
6. Server Components call `auth.getUser()` (verified with Supabase), never
   `getSession()` alone.

Details: `docs/AUTHENTICATION.md`.

## 8. Caching

| Surface                                                             | Strategy                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| `/`, `/assignments`, detail, `/login`, `/submit`, `/my-assignments` | `force-dynamic`; per-request session and data            |
| `GET /api/assignments`                                              | `public, s-maxage=60, stale-while-revalidate=300`        |
| `GET /api/assignments/[id]`                                         | `no-store` (payload may include owner-only pending data) |
| Authenticated endpoints                                             | `no-store`                                               |
| `/api/cron/deadline-reminders`                                      | `force-dynamic`, `no-store`                              |
| `/manifest.webmanifest`                                             | static metadata route                                    |
| `/sw.js`, `/icons/*`                                                | worker `no-cache`; icons immutable                       |
| `sitemap.xml`                                                       | `revalidate = 3600`                                      |
| `robots.txt`                                                        | static                                                   |

Public pages are never cached with user data because they are dynamic. The only shared
cache is the anonymous listing API, which contains published rows only.

## 9. Decisions and trade-offs

**Route Handlers over Server Actions for writes.** Multipart uploads, explicit status
codes, and a documented API contract are easier to test and reason about than a Server
Action whose error shape is implicit.

**Postgres RPCs for listing and course creation.** `list_assignments` avoids N+1 joins
and returns the total in one round trip. `create_or_get_course` is the only controlled
write path into `courses`, so clients never hold INSERT rights there.

**Hand-written DB types.** `src/types/database.ts` mirrors the migrations and is
regenerated with `pnpm db:types` once a local instance exists. It keeps `tsc` useful
before any project is connected.

**User-scoped clients, with one privileged path.** Normal requests use a user-scoped
client and RLS. The cron scheduler is the only runtime path that reads
`SUPABASE_SERVICE_ROLE_KEY`, because claiming a batch across users must bypass RLS.
`claim_notification_deliveries` and friends are granted only to `service_role`. The
trade-off is that this one route must be treated as privileged code and its secret rotated
like any other credential.

**Push over polling.** A durable delivery ledger plus a cron worker keeps reminders
independent of page visits and avoids a browser timer that stops when the tab closes.

**Attachments immutable.** Editing files in place would require delete + re-upload +
record swap. The MVP documents the limitation instead of half-implementing it.

**Fixed +07:00 offset for Jakarta.** Indonesia has no DST, so a fixed offset is exact and
deterministic on both server and client. `Intl` is still used for formatting.

## 10. Failure behaviour

- Missing Supabase env → `isSupabaseConfigured()` false → public shell + setup notice;
  API returns 503 `service_unavailable`.
- Database error → logged with the Postgres code only; client sees a generic message.
- Rate-limiter outage → fails open (availability over blocking), logged for alerting.
- Storage cleanup failure → logged, does not fail the user's delete request.
- Push not configured → settings shows "not configured"; cron route returns 503.
- Scheduler failure → `500` with a generic message; the next run re-claims `pending` rows,
  and rows stuck in `processing` are requeued after 10 minutes.
- Expired subscription (`404`/`410`) → that device is disabled; other devices still receive
  the reminder.
- Sitemap query failure → static entries only.

## 11. Known gaps

- No background job for orphaned storage objects if cleanup itself fails mid-way.
- No automatic retention job for `notification_deliveries`; cleanup is manual SQL.
- The reminder scheduler is not active until a cron source is configured. On Vercel Hobby
  the 10-minute schedule needs Pro; see `docs/PUSH_NOTIFICATIONS.md`.
- Content reports and account suspension are not implemented, so platform moderation
  covers assignments and classes only.
- The class workflow requires a manually seeded first platform admin.
- Pending attachments are readable by every class admin of that class, not only the
  assigned reviewer; reviewer assignment is not modelled.
- No CSP nonce; `script-src` allows inline scripts for Next.js hydration.
- No observability integration (Sentry/OTel); logs are structured JSON-ish `console.error`.
