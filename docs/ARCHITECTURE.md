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

| Layer                 | Location                                                                                                                         | Rule                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Contracts             | `packages/contracts`                                                                                                             | Zod schemas + constants. No React, no DB.                                                                                 |
| Shared helpers        | `packages/shared`                                                                                                                | Pure formatting and Asia/Jakarta deadline logic.                                                                          |
| Presentation          | `apps/web/src/app`, `src/components`                                                                                             | Rendering only; no SQL.                                                                                                   |
| Feature orchestration | `src/features/assignments`, `src/features/classes`, `src/features/sessions`, `src/features/integrations`, `src/features/profile` | Multi-step operations (DB row → upload → attachment rows → rollback; RSVP; calendar sync; profile + avatar + class join). |
| Push orchestration    | `src/lib/push`                                                                                                                   | Reminder planning, payloads, sender, scheduler, capability detection.                                                     |
| Provider adapters     | `src/lib/integrations/google`                                                                                                    | OAuth, token encryption, Calendar REST calls. Nothing above this layer knows Google exists.                               |
| Data access           | `src/lib/db`                                                                                                                     | Every Supabase query lives here.                                                                                          |
| Platform              | `src/lib/supabase`                                                                                                               | Client factories (`server`, `client`, `proxy`).                                                                           |
| Cross-cutting         | `src/lib/api`, `src/lib/security`, `src/lib/storage`, `src/lib/env`                                                              | Errors, rate limits, redirects, file validation, signed URLs.                                                             |

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

- `(site)` holds public discovery: `/classes/discover`, `/classes/[slug]`,
  `/invite/[token]`.
- `(onboarding)` holds `/onboarding`: a minimal shell (brand strip + centred column) outside
  the workspace chrome, so the completeness gate cannot redirect into a page that redirects
  back.
- `(workspace)` holds the student workspace: `/dashboard`, `/my-assignments`,
  `/sessions`, `/leave-requests`, `/dashboard/applications`, the personal class
  directory (`/classes`, `/classes/join`), and member class pages. Its navigation is
  student-only; no admin or developer entry appears here.
- `(console)` holds the staff surfaces, each with its own shell and nav:
  `/admin/*` (platform admin) and `/developer/*` (developer). The only way in from
  the student workspace is the account menu, which shows the console link for the
  matching role.
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

## 7. Session and calendar path

```
POST /api/sessions
  ├─ session?                  no → 401
  ├─ rate limit                30/hour per user
  ├─ Zod parse                 → 422 with fieldErrors
  ├─ getClassRole(classId)     !canManage → 403 (friendly pre-check only)
  ├─ create_discussion_session re-checks can_organize_class_sessions inside SQL
  └─ 201

PUT /api/sessions/[id]/rsvp
  ├─ session?                  no → 401
  ├─ rate limit                120/hour per user
  ├─ rsvp_discussion_session   FOR UPDATE on the session row
  │    ├─ can_view_session?    no → 42501 → 403
  │    ├─ status/window checks → SS002 | SS003 → 409
  │    ├─ capacity check       → SS001 → 409
  │    └─ upsert (session,user) + audit + notify the organiser
  └─ 200 with fresh counts

GET /api/cron/session-jobs      (Bearer CRON_SECRET)
  ├─ reminders: candidates → audience → enqueue → claim → re-validate → send
  └─ calendar:  processDueCalendarSyncs(20)
```

Two design decisions matter here:

- **The database is the write boundary.** The route resolves the caller and gives
  a fast `403`, but the function repeats the permission check with `auth.uid()`.
  A route that is later changed, or a direct RPC call, still cannot escalate.
- **Side effects live with the state change.** Cancelling a session, moving its
  start time, and reopening it each settle reminders and calendar mappings in the
  same transaction as the status write, so no background job has to notice.

The calendar integration isolates the provider behind `lib/integrations/google`:
`oauth.ts` (tokens), `calendar-api.ts` (events), `token-crypto.ts` (envelope), and
`oauth-state.ts` (CSRF binding). The feature service above them decides what to
sync and records the result in `google_calendar_event_mappings`. Nothing outside
those modules knows Google exists, and no credential ever crosses to the client.

## 8. Absence request path

```
POST /api/leave-requests
  ├─ session?                  no → 401
  ├─ rate limit                20/hour per user
  ├─ Zod parse                 → 422 with fieldErrors
  ├─ create_leave_request      re-checks class membership inside SQL
  └─ 201

POST /api/leave-requests/[id]/evidence        (multipart)
  ├─ content-length pre-check  → 413 before reading the body
  ├─ magic-byte validation     ignores the declared MIME type
  ├─ upload to private bucket  leave-evidence/{studentId}/{requestId}/...
  ├─ add_leave_request_evidence  registers the row; rolls the object back on failure
  └─ best-effort OCR, never blocking the upload

POST /api/classes/[slug]/leave-requests/forward
  ├─ requireClassManager       server-side class-admin check
  ├─ selection scoped to the class; non-submitted rows rejected
  ├─ PDF generated BEFORE the commit RPC, so a generation failure cannot
  │  leave a request marked forwarded
  └─ complete_leave_forwarding FOR UPDATE + UNIQUE (idempotency_key)

POST /api/leave-requests/[id]/cancel
  ├─ owner (draft or submitted) or class admin (submitted)
  ├─ cancel_leave_request     re-checks the state inside SQL
  └─ cancelled is terminal; no transition leaves it
```

Two invariants shape the design:

- **Forwarding is not approval.** `forwarded` only means "included in a
  successfully completed forwarding package". There is no approve/reject state;
  the lecturer decides outside StarsTask, and a class admin can only forward,
  export, or cancel.
- **Evidence is private by construction.** The bucket is private, keys embed the
  owner and request IDs, preview uses 5-minute signed URLs, and every read is
  re-authorized server-side. OCR is an optional helper; nothing is decided from
  it and every extracted value must be confirmed by the student first.

Details: `docs/LEAVE_REQUESTS.md`.

### My Week

`/dashboard` renders one timeline of deadlines, sessions, and the student's own
absence requests for the next seven Asia/Jakarta days. `getMyWeek()` reads the
three sources in parallel, keeps only items inside the window, and sorts them by
instant. An absence request anchors to its start date, or to today while it is
ongoing, so the row does not move at midnight. Draft and cancelled requests are
hidden, matching the rest of the absence UI.

## 9. Calendar and share surfaces

```
GET /api/classes/[slug]/calendar      authenticated, rate limited
  ├─ class must exist and be active
  ├─ published assignment deadlines
  ├─ sessions with visibility = 'public' only
  └─ buildIcsCalendar() → text/calendar, no-store
```

Assignment deadlines are private to signed-in readers, so the feed cannot be a
public calendar subscription URL.

`opengraph-image.tsx` on an assignment route renders a share card with
`next/og`. Without a verified session it renders a generic card rather than the
assignment title, course, or deadline.

## 10. Trust loop

```
POST /api/assignments/[id]/reports
  ├─ session?                  no → 401
  ├─ rate limit                20/hour per user
  ├─ assignment published?     no → 404
  ├─ Zod parse                 → 422
  └─ report_assignment         upsert the caller's one open report

PATCH /api/admin/assignment-reports/[id]      platform admin only
  ├─ Zod parse                 → 422
  └─ review_assignment_report  can_manage_class + open-only + audit entry
```

A report is advisory: it never edits the brief. The reviewer fixes the brief
through the normal assignment path, then resolves the report with a note.

Revisions are written by a trigger on `assignments`, not by application code, so
no write path can skip the history. The snapshot holds only reader-visible
fields. History is visible to the author and to class/platform managers; RLS
returns an empty list for anyone else, which hides the section entirely.

## 11. Authentication path

1. `/login` validates `next` with `safeRedirectPath()`.
2. The browser client calls `signInWithOAuth({ provider: "google" })` with
   `redirectTo = {origin}/auth/callback?next=...`.
3. Google → Supabase `/auth/v1/callback` → `/auth/callback?code=...`.
4. The callback rate-limits, exchanges the code for a session (PKCE verifier cookie),
   confirms the profile exists, and redirects to the sanitized `next`.
5. If the profile exists but `onboarded_at` is `NULL`, the callback sends the user to
   `/onboarding?next=<sanitized>` instead. The same check runs once on `/login`, and the
   workspace layout repeats it on every request so a direct URL cannot skip it.
6. `src/proxy.ts` refreshes the session on every matched request and mirrors cookies.
7. Server Components call `auth.getUser()` (verified with Supabase), never
   `getSession()` alone.

No second sign-in is needed: the session from step 4 is already valid, and onboarding only
posts the profile form to `/api/profile/onboarding`.

Details: `docs/AUTHENTICATION.md`.

## 12. Caching

| Surface                                                             | Strategy                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| `/`, `/assignments`, detail, `/login`, `/submit`, `/my-assignments` | `force-dynamic`; per-request session and data            |
| `GET /api/assignments`                                              | `no-store`; authenticated readers only                   |
| `GET /api/assignments/[id]`                                         | `no-store` (payload may include owner-only pending data) |
| Authenticated endpoints                                             | `no-store`                                               |
| `/api/cron/deadline-reminders`                                      | `force-dynamic`, `no-store`                              |
| `/manifest.webmanifest`                                             | static metadata route                                    |
| `/sw.js`, `/icons/*`                                                | worker `no-cache`; icons immutable                       |
| `sitemap.xml`                                                       | Static public routes only; no assignment URLs            |
| `robots.txt`                                                        | static                                                   |

Assignment pages and APIs require a verified session and never use a shared cache.

## 13. Decisions and trade-offs

**Route Handlers over Server Actions for writes.** Multipart uploads, explicit status
codes, and a documented API contract are easier to test and reason about than a Server
Action whose error shape is implicit.

**Postgres RPCs for listing and course creation.** `list_assignments` avoids N+1 joins
and returns the total in one round trip. `create_or_get_course` is the only controlled
write path into `courses`, so clients never hold INSERT rights there.

**Hand-written DB types.** `src/types/database.ts` mirrors the migrations and is
regenerated with `pnpm db:types` once a local instance exists. It keeps `tsc` useful
before any project is connected.

**Nickname in `display_name`, private columns behind RPCs.** Onboarding writes the
student's chosen nickname into the existing `display_name`, so every public surface keeps
working untouched and the legal name never leaks by accident. `full_name` and `nim` have no
client grant at all; the owner reads and writes them through `get_my_profile` /
`update_my_profile`, which derive the owner from `auth.uid()`.

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

## 14. Failure behaviour

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

## 15. Known gaps

- No background job for orphaned storage objects if cleanup itself fails mid-way.
- No automatic retention job for `notification_deliveries`; cleanup is manual SQL.
- The reminder scheduler is not active until a cron source is configured. On Vercel Hobby
  the 10-minute schedule needs Pro; see `docs/PUSH_NOTIFICATIONS.md`.
- Content reports are limited to assignment briefs; account suspension and
  comment/rating moderation do not exist, so platform moderation covers assignments
  and classes only.
- Campus email / NIM verification is not implemented. The onboarding form accepts a
  student ID as a self-declared value with no proof; real verification needs an
  allowlist or identity-provider decision before it can be built.
- The public ICS feed is deliberately limited to published deadlines and `public`
  sessions; it has no per-user feed and no auth, so it cannot carry personal items.
- Duplicate-assignment detection is manual: `report_assignment` lets a reader flag
  `duplicate`, but nothing groups or auto-merges the reports.
- The OCR helper only reads a PDF's text layer (`unpdf`); scanned images need an
  external provider wired into `lib/ocr`, which is not configured by default.
- Leave evidence has no automatic retention or cleanup job; removal is a soft
  delete plus a best-effort object deletion.
- The class workflow requires a manually seeded first platform admin.
- Pending attachments are readable by every class admin of that class, not only the
  assigned reviewer; reviewer assignment is not modelled.
- No CSP nonce; `script-src` allows inline scripts for Next.js hydration.
- No observability integration (Sentry/OTel); logs are structured JSON-ish `console.error`.
- Session calendar sync is one-directional and has no webhook, so an event edited in
  Google is overwritten on the next sync and a deleted one is recreated. That is
  deliberate (StarsTask is the source of truth) but means Google-side edits are lost.
- Calendar sync runs on the same 10-minute cron as reminders; a session changed minutes
  before it starts may reach Google Calendar slightly late.
- Session reminders only cover `going` participants; `maybe` is never reminded.
