# StarsTask — Architecture Discovery & Technical Audit

> **Nature of this document:** read-only discovery. No code was modified to produce
> it. Every claim is grounded in files that exist in `C:\project\Startask` at audit
> time. Where a claim cannot be proven from the repo, it is marked **Assumption**.
> Where a claim is a recommendation, it is marked **Recommendation**.

**Audit date:** 2026-11-04 · **Repo:** pnpm monorepo (`apps/web`, `packages/contracts`, `packages/shared`) ·
**Migrations:** 78 files · **Tables:** 51 · **API routes:** 113 · **Pages:** 78 · **Components:** 273

> **Owner answers received 2026-11-04** (post-audit, §12): production is **already
> deployed** (contradicting `docs/DEPLOYMENT.md`'s "never deployed" claim — that doc is
> stale); planning scale = **100 classes**; MENTARI UNPAM is **deferred**; retention/
> cascade-delete policy is **undecided**. A reassessment under these answers follows in
> §10.1 below.

---

## 1. Executive Summary

StarsTask today is a **modular monolith**: a Next.js 16 App Router application backed
exclusively by Supabase (PostgreSQL + Auth + Storage). There is no separate backend,
no Realtime usage, no worker infrastructure, and no deployment has ever been executed
(`docs/DEPLOYMENT.md` states this explicitly). Security posture at the database layer
is genuinely strong — RLS is enabled on all 51 tables and permission checks are
membership-scoped via `SECURITY DEFINER` helpers rather than global user roles.

The system's real weaknesses are **not** in authorization. They are:

1. **Synchronous, in-memory, unbounded exports** (XLSX/PDF/ZIP) executed inside API
   routes with no timeout budget — the most likely production failure mode. *(High, confirmed)*
2. **Query fan-out patterns** (Action Center `4 × N` round-trips per load; in-memory
   pagination after over-fetch) that degrade linearly with the number of classes.
   *(High, confirmed)*
3. **Silent data truncation at hardcoded limits** (500/1000 rows) with no pagination or
   total-count — exports and calendar can return *incomplete* data without any signal.
   *(High, confirmed)*
4. **No observability.** Structured `console.error` is the only instrumentation; no
   Sentry/OTel anywhere. There is no way to measure pain, so infrastructure decisions
   are currently un-sizable. *(Medium, confirmed)*
5. **Scheduling fragility.** Sub-daily cron depends on a GitHub Actions schedule, which
   GitHub disables after 60 days of inactivity and which has never been observed
   running. *(Medium, confirmed)*

**Hybrid verdict (detail in §10):** the application would **not** benefit from a
FastAPI/ worker split today. The honest sequence is: observability → fix the shape
problems (parallelism, pagination, `maxDuration`) → extract *one* worker only if
exports/push measurably exceed serverless limits. A modular monolith is the right
shape at this stage — but with module boundaries enforced that the codebase currently
only partially follows.

**Process note:** `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/SECURITY.md`, and
`docs/DEPLOYMENT.md` are **partially stale** (§9 lists contradictions found). Before
the Hybrid decision, the docs should be re-synced with reality — an architecture built
on stale docs inherits their errors.

---

## 2. Actual Technology Stack

All versions from `apps/web/package.json` and `packages/contracts/package.json`.

| Layer | Technology | Version | Evidence | Verdict |
|---|---|---|---|---|
| Frontend / server | Next.js (App Router) | 16.4.3 | `apps/web/package.json:32`, route groups `(home)/(site)/(workspace)/(console)/(onboarding)` in `apps/web/src/app/` | Confirmed |
| UI | React | 19.3.1 | `apps/web/package.json:34` | Confirmed |
| Styling | Tailwind CSS | 4.3.3 | `apps/web/package.json:53` | Confirmed |
| Validation | Zod | 4.6.7 | `apps/web/package.json:40`, all of `packages/contracts/src/` | Confirmed |
| Database | PostgreSQL via Supabase | — | 78 migrations in `supabase/migrations/`, 27 files in `src/lib/db/` | Confirmed |
| Auth | Supabase Auth (Google OAuth PKCE) | `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0 | `apps/web/src/components/auth/google-sign-in-button.tsx:43-49`, `src/app/auth/callback/route.ts:84-86` | Confirmed |
| Storage | Supabase Storage (signed URLs) | — | `src/lib/storage/attachments.ts`, `leave-evidence.ts`, `avatars.ts`, `class-media.ts` | Confirmed |
| Realtime | — | — | **Zero** matches for `postgres_changes`/`.channel(`/presence in `apps/web/src` | **Not implemented** |
| API comms | Route Handlers (113 `route.ts`), **no Server Actions** | — | `grep "use server"` = 0 | Confirmed |
| Middleware | `src/proxy.ts` (Next 16 proxy convention; no `middleware.ts`) | — | session refresh + CSP nonce | Confirmed |
| Web Push | `web-push` (VAPID) | 3.6.7 | `src/lib/push/sender.ts:3,113`, service worker in `next.config.ts:55-70` | Confirmed |
| XLSX / PDF / ZIP | `exceljs`, `pdf-lib`, `jszip` | 4.4.0 / 1.17.1 / 3.6.7 | `src/features/attendance-meetings/excel.ts:3`, `src/features/leave/reports/*.ts`, all `server-only` | Confirmed, server-side only |
| OCR | `unpdf` (PDF text layer only) | 2.0.0 | `src/lib/ocr/pdf-text.ts`, registry `src/lib/ocr/index.ts:18-20` (only `pdf-text`) | Confirmed, narrow scope |
| Rate limiting | Upstash Redis **optional**; default = Postgres `consume_rate_limit` RPC | `@upstash/redis` 1.40.0, `@upstash/ratelimit` 2.2.0 | `src/lib/security/rate-limit.ts:149-186` (dynamic import only when env set) | Confirmed, conditional |
| Google Calendar | Custom REST adapter (raw `fetch`, no `googleapis` package) | — | `src/lib/integrations/google/calendar-api.ts:28`, `oauth.ts`, `token-crypto.ts` | Confirmed |
| Deployment | Vercel (target, **never deployed**) | — | `apps/web/vercel.json`, `docs/DEPLOYMENT.md:7-10` | Target confirmed; production **never deployed** |
| CI / cron | GitHub Actions | — | `.github/workflows/ci.yml`, `cron.yml` (`*/10 * * * *`) | Confirmed in repo; execution **unverified** |
| Observability | none | — | No Sentry/OTel in `package.json`; `console.error` only | Confirmed gap |
| Testing | Vitest (unit), Playwright (e2e) | 5.0.5 / 1.64.1 | `apps/web/tests/` — **90 unit + 4 integration + 4 e2e**; 1031 tests, all passing at audit time | Confirmed |
| Auth | Google OAuth via Supabase Auth | — | `src/components/auth/google-sign-in-button.tsx:43-49` | Confirmed |

**Dependencies present but unused (confirmed by grep):** `axe-core` (devDep) has no
import anywhere — only `@axe-core/playwright` is used in e2e. Severity **Low**. All other
runtime deps have at least one real import in `src/`.

**Never implemented despite being common assumptions:** Supabase Realtime, CAPTCHA/Turnstile
(zero matches — abuse control is honeypot + rate limit only).

---

## 3. Project Structure Analysis

**Monorepo layout** (`pnpm` workspaces):

```
apps/web          Next.js application (the whole product)
  src/app         78 pages in 5 route groups, 113 API route handlers
  src/components  273 .tsx components (incl. ui/ from Radix primitives)
  src/features    business services (server-only), e.g. assignments, leave, sessions,
                  attendance-meetings, classes, integrations
  src/lib/db      27 Supabase data-access modules
  src/lib         auth, push, storage, ocr, geo, utils
packages/contracts  Zod schemas (query, event, assignment, leave, session, ...)
packages/shared     date/calendar utils, ICS builder, timeline helpers
supabase/migrations 78 ordered SQL migrations (schema + RLS + RPCs)
```

**Layering as built:** Route Handlers → `features/*` services (66 direct `supabase.rpc()`
call sites) → `lib/db/*` (PostgREST) → Postgres. Server Components read directly via
`lib/db`. Client components call `/api/*` with `fetch` (~100 call sites) and never import
`server-only` modules.

**Responsibility problems (confirmed):**

| Finding | Evidence | Severity |
|---|---|---|
| Two parallel authorization surfaces: `lib/auth/admin.ts` (pages) vs `features/classes/class-access.ts` (`requireSession`/`requireClassManager`, API routes) | both exist | Medium — drift risk |
| `lib/db/classes.ts` (1,467 lines) and `lib/db/dashboard.ts` (1,018) are god-modules mixing dozens of unrelated queries | file sizes | Medium |
| `features/*` bypass `lib/db` with direct RPC calls (66 sites), contradicting `docs/ARCHITECTURE.md §2` ("every query lives in lib/db") | grep `supabase.rpc` in features | Medium |
| `features/integrations/google-calendar-service.ts` (646 lines) mixes Google API, privileged admin-client DB writes (7 sites), and sync state machine | `:155-609` | Medium |
| `features/attendance-meetings/excel.ts` 761 lines; `dashboard/actions/page.tsx` 1,177 lines; `leave-form.tsx` 913; `assignment-form.tsx` 879 | file sizes | Medium |

**Strengths to preserve:** contracts are Zod-first and shared between client and server;
heavy modules are pure `server-only` functions (no UI imports), which keeps them
extractable later if ever needed; no Server Actions (single mutation surface via route
handlers + RPCs).

---

## 4. Current Architecture Diagram

```mermaid
flowchart LR
    subgraph Client["Browser (Next.js App Router)"]
        RSC["Server Components (78 pages)"]
        CC["Client components (273)"]
    end

    RSC -->|"direct reads"| DBL[("lib/db/* (PostgREST)")]
    CC -->|"fetch /api/*"| RH["Route Handlers (113)"]
    RH -->|"server-only services"| FS["features/* (assignments, leave,<br/>sessions, attendance, integrations)"]
    FS -->|"rpc() + from()"| DBL
    DBL -->|"user-scoped client + RLS"| PGS[("PostgreSQL (Supabase)")]

    subgraph DB["Supabase platform"]
        PGS
        RPC["~90 SECURITY DEFINER RPCs<br/>+ role helpers"]
        AUTH["Supabase Auth (Google PKCE)"]
        STORE["Storage buckets<br/>+ signed URLs"]
    end

    FS -->|admin client (cron/dev only)| RPC
    GH["GitHub Actions cron<br/>*/10 min"] -->|bearer CRON_SECRET| CRON["/api/cron/* (5 routes)"]
    CRON -->|claim & fan-out| PUSH["Web Push (VAPID)"]
    PUSH -->|after() ≤4 routes| PUSH
    GH -->|QODER|<|reserved_token_163686|> DOCS["docs/ (6 files)"]
    M["MENTARI UNPAM (future)"] -.->|planned, no code| FS
```

**Key observations from the diagram:** everything funnels through Route Handlers + RPCs;
`notification_events` is the single cross-feature bus (see §7); there is no realtime
channel anywhere in the graph; the only asynchronous actors are cron routes (one external
scheduler) and 4 `after()` immediate dispatches.

---

## 5. Database Schema and Relationship Analysis

**51 tables** grouped by domain (migration filenames cited as evidence):

- **Identity:** `profiles` (1—1 with `auth.users`, CASCADE), `platform_admins` (no client grants).
- **Classes:** `classes` (`status: draft/active/archived`, slug unique, `course_id → courses RESTRICT`),
  `class_members` (PK `(class_id,user_id)`), `class_admins` (**composite FK to
  `class_members`** — an admin is structurally always a member), `class_subjects`,
  `class_invitations`, `class_invitation_acceptances/declines`, `class_applications`,
  `class_application_reviews`, `class_verification_requests` + evidence + reviews.
- **Assignments:** `assignments` (`status: draft/pending_review/pending/published/rejected/unpublished/archived`,
  `class_id/course_id/subject_id` all nullable, `content_type` includes
  `class_announcement`), `assignment_attachments`, `assignment_reviews` (append-only),
  `assignment_revisions`, `assignment_reports`, `assignment_completions` (per-user personal mark).
  **There is no `submissions` table** — a submission is an `assignments` row in
  `pending_review`/`pending`.
- **Attendance:** **no dedicated tables.** Attendance is a mode of `discussion_sessions`
  (`subject_id + meeting_number`, `UNIQUE(class_id,subject_id,meeting_number)`, open/close/
  finalize state machine) + `discussion_session_checkins` (`UNIQUE(session_id,user_id)`,
  geo/manual/system status). `attendance_correction_audits` stores class+course+student+meeting
  explicitly; check-ins do not (they resolve via session). `attendance_verification_attempts`
  stores outcomes, deliberately not typed name/NIM.
- **Leave:** `leave_requests` (`draft/submitted/approved/rejected/revision_requested/forwarded/cancelled`),
  `leave_request_evidence` (soft removal `removed_at`), `leave_request_history` (append-only),
  `leave_request_forwardings` + items (`UNIQUE(request_id)` → forwardable **once, forever**,
  `UNIQUE(idempotency_key)`), `leave_lecturer_outcomes`.
- **Calendar:** `personal_calendar_events` (owner-only), `class_calendar_events` (admin-written),
  `class_course_schedules` (weekly recurrence), `google_calendar_connections` +
  `google_calendar_event_mappings` (encrypted tokens).
- **Notifications:** `notification_events` (dedupe key unique, lease via
  `FOR UPDATE SKIP LOCKED`), separate ledgers `notification_deliveries`,
  `discussion_session_reminders`, `push_subscriptions` (endpoint unique).
- **Ops:** `audit_logs` (append-only, `SET NULL` on class/user delete — survives),
  `auth_activity_events`, `app_activity_events`, `app_error_events`,
  `developer_incidents` + notes, `feedback_entries`, `rate_limits` (internal).

**Relationships that matter for Hybrid:** every class-scoped entity hangs off `classes`;
every user-scoped entity off `auth.users`; `courses` is the only `RESTRICT` anchor
(cannot delete a course with assignments/classes). The notification pipeline is entirely
DB-mediated (RPCs enqueue; cron claims) — no in-app queue.

**Integrity risks (evidence in §9):** user delete cascades ~everything; class delete cascades
members/subjects/sessions/check-ins/leave; hard deletes are the norm; archiving semantics
are inconsistent across tables (status-based in some, soft-remove in evidence, hard delete
elsewhere).

---

## 6. Authentication, Authorization, and RLS Audit

**Authentication:** Google OAuth (PKCE) via Supabase Auth
(`google-sign-in-button.tsx:43-49` → `exchangeCodeForSession` in `auth/callback/route.ts:84-86`,
`next` allowlisted via `safeRedirectPath`). Server gate is `getSessionUser()`
(`lib/auth/session.ts:27`, React-cached) using `auth.getUser()` — the verified token,
never `getSession()`. Used in ~50 pages/layouts.

**Authorization:** permission is **membership-scoped, not global-role** — exactly matching
the product rule. Roles are rows: `class_members` (student), `class_admins` (subset via
composite FK), `platform_admins`. Checked via `SECURITY DEFINER` helpers
(`is_class_member`, `is_class_admin`, `is_platform_admin`, `can_manage_class`,
`can_organize_class_sessions`, `can_publish_public_assignment`) to avoid RLS recursion.
**No `lecturer` login role exists** — lecturer is free text; lecturer decisions are
*recorded by staff* in `leave_lecturer_outcomes`. (Matches product rule "admin in one
class, student in another".)

**RLS:** ENABLED on **all 51 tables** (verified by cross-referencing created-table list
against RLS list — zero tables missing). 10 internal tables are enabled with **no client
policies** = deny-by-default (safe only where grants are also revoked: verified for
`platform_admins`, `rate_limits`, `attendance_verification_attempts`). All other policies
are membership-scoped via definer helpers; writes are overwhelmingly RPC-only
(`SECURITY DEFINER`), giving a strong second enforcement layer beneath RLS.

**Service role:** one factory `createSupabaseAdminClient()` (`lib/supabase/admin.ts`,
`server-only`, `persistSession: false`). Call sites: 5× `/api/cron/*`, push stores, developer
ops layers, Google Calendar service — **plus one user-facing exception:**
`features/classes/class-review-service.ts:92`. Needs review (see §13).

**Confirmed over-permissive surfaces:**

| # | Finding | Severity |
|---|---|---|
| 1 | `profiles_public_read` + `courses_public_read`: `USING (TRUE)` to anon+authenticated. Column grants limit exposure to `(id, display_name, avatar_url)`, but **any future granted column becomes world-readable by default** | Medium |
| 2 | `class_course_schedules_*`: **any class member can insert/update/delete timetable rows** (deliberate per migration comment; no admin check) | High (integrity, not leak) |
| 3 | Historical: `assignments_public_read` exposed all published class assignments cross-class to anon — fixed in stages; documented in `20261102104000` itself. Only correct if **all 78 migrations applied in order** on live DB | Medium (migration-order dependency) |

**Verdict:** the authorization design is sound and matches the business rules. The exposure
is at the *edges* (member-writable timetable, future-column trap, migration-order
dependence), not in the core membership model.

---

## 7. Feature-by-Feature Architecture Analysis

| Feature | Frontend | API / Logic | Tables | AuthZ | Storage / External | Limitations |
|---|---|---|---|---|---|---|
| **Assignments** (publication requests, submissions, completions) | `app/(workspace)/assignments/*`, `dashboard/classes/[slug]/submit|review|submissions/revise`, `assignment-form.tsx` | `api/assignments/*`, `api/classes/[slug]/submissions/*`, `admin/assignments/[id]/review`; `features/assignments/assignment-service.ts`, `features/classes/class-submission-service.ts`, RPCs `submit_class_assignment`, `review_class_assignment` | `assignments` (+attachments, reviews, revisions, reports, completions) | RLS reads + RPC writes; insert policy owner+member+`pending` (admins bypass); escalation trigger | `assignment-attachments` bucket; Drive URL = plain string | In-memory pagination for mixed-source lists (High); no realtime review queue (Medium) |
| **Absence Requests** | `leave-requests/*` + class-side `history/forward`, `components/leave/*` | `api/leave-requests/*`, `api/classes/[slug]/leave-requests/*/review|forward|export`; `features/leave/leave-service.ts` — each mutation a **single definer RPC** ("authorization, status validation, history, notifications all happen inside DB function") | `leave_requests` (+evidence, history, forwardings, lecturer outcomes) | RPC + RLS reads; reviewer queue filtered to managed classes | `leave-evidence` bucket; OCR (pdf-text only) | Export unbounded in memory (Medium); forwarding irreversible by design (Low) |
| **Attendance** (sessions + meetings) | `sessions/*` + `attendance/*` (two systems live side-by-side) | `api/sessions/*`, `api/classes/[slug]/attendance/meetings/*`, `api/attendance/meetings/[id]/checkin`; `features/sessions/session-service.ts`, `features/attendance-meetings/meeting-service.ts` | `discussion_sessions` + checkins/RSVPs (+ `attendance_verification_attempts`, `attendance_correction_audits`) | RPC `can_organize_class_sessions`; check-in window/identity enforced in DB | Geo (browser), Maps-link resolver; no storage | `MAX_ROWS=5000` caps (Medium); dual models confusing (Low) |
| **Action Center** | `dashboard/actions/page.tsx` (4 tabs) | Server Component → `lib/db/class-actions.ts::getClassActionCenter()` + `lib/classes/action-center.ts` pure merge | `assignments`, `leave_requests`, `discussion_sessions`, `assignment_reports` | RLS + code filter `is_admin && active` | none | **4×N head-count fan-out per load, no RPC** (High); recent list sliced in memory (Medium); no realtime (Medium) |
| **Exports** (XLSX/PDF/ZIP) | download links | `api/classes/[slug]/attendance/exports/*`, `api/classes/[slug]/leave-requests/export`; `features/attendance-meetings/excel.ts` (761 lines), `leave/reports/{pdf,zip,csv}.ts` | read models only | `requireClassManager` + subject-in-class | in-memory `ExcelJS`/`pdf-lib`/`jszip`; evidence bytes embedded | **Sync, no queue, no `maxDuration`** (High); silent 500-row truncation (High); no audit/deny-list (Medium) |
| **Notifications** | `notifications/page.tsx`, bell, settings | `api/notifications/read`, `api/push/*`; `lib/push/{event-store,event-scheduler,dispatch,sender,batch}.ts`; cron `api/cron/notification-events` (limit 100) | `notification_events` (+ deliveries, session reminders ledgers) | RLS inbox; claim RPCs service-role-only | Web Push (VAPID) | Only 4 routes dispatch immediately via `after()`; rest cron-bound at 10 min (Medium); no realtime inbox (Medium) |
| **Classes / Members** | `classes/*`, class dashboard, `manage/members` | `api/classes/*` incl. invitations, applications, subjects, media; `features/classes/class-*-service.ts` | `classes`, members, admins, subjects, invitations | RLS + RPC join/apply; `requireClassManager` | `class-media` bucket | Member list capped at 500 (Medium) |
| **Schedule / Calendar** | `schedule/page.tsx`, class schedule, `components/schedule/*` | `api/classes/[slug]/schedule/*`, `api/calendar/*`, `api/classes/[slug]/calendar-events/*`; `lib/db/calendar.ts` merges 6 sources | `class_course_schedules`, `personal/class_calendar_events`, sessions, assignments, leave | RLS member-scoped; personal owner-only; official admin | Google Calendar sync; ICS download | 500/source caps silently truncate (Medium); recurrence expanded per-range (Medium) |
| **Materials** | `courses/[courseId]/materials/page.tsx` | `api/classes/[slug]/materials/*` → `lib/db/course-materials.ts` | `course_materials` | `requireClassManager` + RLS reads | none — URL only | No file storage, `limit(100)` (Medium) |
| **Announcements** | `courses/[courseId]/announcements/page.tsx` | class-admin post publish (`content_type='class_announcement'` on assignments) | `assignments` | admin write, member read | none | Shares assignment lifecycle semantics (Low) |
| **Settings / Profile** | `settings/profile|notifications|calendar|feedback`, onboarding | `api/profile/*`, `api/feedback`, `api/push/preferences`; RPCs `get_my_profile`/`update_my_profile` (private columns have no client grant) | `profiles`, `notification_preferences`, `feedback_entries` | Owner-only RPC | `avatars` bucket; Google Calendar connection | single-file avatar, no crop (Low) |

**Cross-feature communication (confirmed):** a single DB-mediated bus —
`SECURITY DEFINER` RPCs (class publish/invite/admin, session update/rsvp, leave
submit/revision/forward, verification, moderation, report review) call
`enqueue_notification_event()` → `notification_events` → cron claim (`FOR UPDATE SKIP
LOCKED`, limit 100) → VAPID fan-out + RLS inbox. Deadline reminders and session reminders
are **separate ledgers** (`notification_deliveries`, `session_reminders`), not the inbox
queue. Google Calendar sync is a per-user OAuth + per-session port with retry; failures
are typed, never user-thrown.

---

## 8. Performance and Reliability Findings

**Confirmed (code evidence):**

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | **Export rows silently truncated at `.limit(500)`** with no pagination/total: leave export, calendar (7 sites), class attendance tables (1,000), class members | `lib/db/leave.ts:655`, `lib/db/calendar.ts` (`EVENT_LIMIT`), `lib/db/class-attendance.ts:197,224,255`, `lib/db/classes.ts:585` | **High** (correctness) |
| 2 | **Action Center fan-out:** `4N` `count(head:true)` round-trips per page load; merged in memory, `slice(0,10)` | `lib/db/class-actions.ts:60-107` | **High** (latency at scale) |
| 3 | **Exports synchronous + fully in-memory**, no `maxDuration` on export routes (only cron sets 60s), no streaming | `api/.../attendance/exports/recap/route.ts:75`, `api/.../leave-requests/export/route.ts` | **High** (timeout/OOM) |
| 4 | Sequential `await` in loops: push claim loop, calendar sync per-row loop, leave-ZIP evidence fetch one-by-one | `lib/push/scheduler.ts:145-191`, `google-calendar-service.ts:625-635`, `features/leave/reports/zip.ts:53-73` | Medium |
| 5 | **Cron fragility:** sub-daily jobs depend on GitHub Actions `*/10 * * * *` — disabled after 60 days of inactivity; only 2 retention jobs are in `vercel.json` | `.github/workflows/cron.yml:8`, `vercel.json`, `DEPLOYMENT.md:427` | Medium |
| 6 | Repeated uncached role RPCs per request (workspace layout + pages), while session fetch *is* cached | `app/(workspace)/layout.tsx:32-40`, `lib/db/classes.ts:548-573` | Low–Medium |
| 7 | `force-dynamic` on ~100 pages/routes: zero caching anywhere (correct for private data, but cost grows with traffic) | repo-wide grep | Low (at current scale) |
| 8 | **Push latency inconsistent by feature:** immediate `after()` dispatch in only 4 routes; everything else waits ≤10 min for cron | `lib/push/dispatch.ts`, 4 route call sites | Medium |

**Potential risks (not proven by code alone):** client bundle size from 273 client
components (heavy libs verified server-only, so only component code contributes — needs
bundle analysis); rate-limiter fail-open for reads when backends unreachable (documented
trade-off, `lib/security/rate-limit.ts:110-123`).

**What is *not* a bottleneck today:** there are no classic sequential N+1 loops in hot
paths (loops run over already-fetched rows), and no realtime subscriptions at all — so no
subscription-scaling concern exists.

---

## 9. Security Risks

| # | Risk | Evidence | Severity | Class |
|---|---|---|---|---|
| 1 | Any class member can write `class_course_schedules` (no admin check) | `20261029003400_...:78-...` deliberates "semua anggota" | High | Confirmed |
| 2 | **User delete cascades** assignments, sessions they organized, check-ins, leave requests (all `ON DELETE CASCADE`) | `core_schema:22,85`, session/leave migrations | High | Confirmed (integrity) |
| 3 | **Class delete cascades** members, subjects, sessions, check-ins, leave, schedules, materials, calendar events | `20261029000900...:225` etc. | High | Confirmed (integrity) |
| 4 | `profiles_public_read`/`courses_public_read` `USING (TRUE)` to anon — column grants mitigate today, **any future granted column is world-readable by default** | `20261029000300...:41-44,85-88` | Medium | Confirmed |
| 5 | Service role used by one user-facing feature service outside cron/admin contexts | `features/classes/class-review-service.ts:92` | Medium | Confirmed |
| 6 | Bulk PII export: manager role can export leave reports (names + medical evidence) repeatedly up to rate limit; leave exports not audit-logged | `leave-requests/export/route.ts` | Medium | Confirmed |
| 7 | Historical cross-class assignment read (anon) — fixed in stages, but **only correct if all 78 migrations applied in order** on the live DB | `20261102104000...` documents the hole | Medium | Confirmed |
| 8 | OCR default enabled (`pdf-text`) while `DEPLOYMENT.md` claims `OCR_PROVIDER=disabled` default — operators believe OCR is off when text extraction actually runs on uploaded evidence | `lib/ocr/index.ts:22,32` vs `docs/DEPLOYMENT.md:241,275` | Medium | **Confirmed doc/code contradiction** |
| 9 | Attachment owner-folder read (`foldername(name)[1] = auth.uid()` OR published assignment) with weak path validation | `20261030180000` storage policy | Medium | Potential |
| 10 | Missing leading-column indexes on several FK/cascade columns (all Low: nullable historian/actor columns + ~6 real ones, e.g. `notification_deliveries.assignment_id`, `course_materials.class_id`) — cascade deletes seq-scan | migrations (see §5 research) | Low | Confirmed |
| 11 | No CAPTCHA/Turnstile; abuse control = honeypot + rate limits only | zero matches repo-wide | Low | Confirmed |

---

## 10. Hybrid Architecture Readiness Assessment

**Short answer: the codebase is not a good candidate for a Hybrid split today. A modular
monolith is the appropriate shape; the current monolith should be hardened, not split.**

| Candidate responsibility | Should it move? | Evidence / reasoning |
|---|---|---|
| Anything requiring FastAPI | **No.** No Python-relevant logic exists (OCR = PDF text-layer via `unpdf`; no pandas/ML/image pipeline). The only external integration (Google Calendar) is a REST adapter callable from anywhere. | `lib/ocr/index.ts`, `lib/integrations/google/*` |
| Export generation (XLSX/PDF/ZIP) | **Not as a service — as a bounded worker later, only if measured.** Callee is already pure `server-only`; the fix is `maxDuration`, parallelism, streaming, pagination — not a new runtime. | `features/attendance-meetings/excel.ts`, export routes |
| Push dispatch | **No.** Claim machinery is already externalized (HTTP + bearer token cron pattern); VAPID send is fast. | `api/cron/*`, `lib/push/*` |
| OCR | **No (Python), maybe later (worker) only if** scanned-image OCR is added — that would be the *first* workload where a separate process genuinely helps. | `lib/ocr/pdf-text.ts` |
| Business logic generally | **No.** Authoritative logic lives in **Postgres RPCs** (`SECURITY DEFINER`), which any client can call; moving app-level logic to FastAPI would *weaken* the single enforcement point. | 66 RPC call sites, §6 |
| DB / Auth / RLS / Storage | **Stay Supabase.** This is the enforcement core; re-platforming it buys nothing. | §5–6 |
| Next.js surface (pages, route handlers, forms) | **Stay.** Cohesive with contracts + RLS model; 78 pages already built. | §3 |

**Costs a split would introduce (evidence-based):** a second deployment/observability
surface; duplicated secrets (service-role key currently imported only via
`lib/supabase/admin.ts` — a split would double the secret-handling surface for VAPID +
Google tokens); cross-service contract drift (today's contracts are Zod in one repo);
and debugging across three runtimes — **all with zero measured pain to justify it**,
because there is no observability (§8).

**The sequencing that actually pays off:** (1) add observability (Sentry/OTel) so pain is
measurable; (2) fix shapes — bounded parallelism in fan-outs, DB pagination for exports,
`maxDuration` on export routes, consolidate the dual authorization surfaces; (3) *only if*
exports/push measurably exceed serverless limits, extract **one** worker behind the
existing cron-HTTP pattern. The architecture is already worker-shaped (HTTP + bearer cron,
pure server-only modules) — the migration, when needed, is mechanical.

### 10.1 Reassessment under owner answers (2026-11-04)

With **production live** and **100-class planning scale**, the risk ranking shifts —
but the Hybrid verdict **does not change**, because the evidence still shows no
FastAPI-shaped workload:

| Audited risk | At 100 classes | Consequence |
|---|---|---|
| Action Center `4N` counts (§8 #2) | ~400 `head:true` counts per admin page load (parallel, so latency ≈ slowest, but connection pressure scales with N) | Becomes the first real scaling cliff. Fix: aggregate into **one RPC** (counts per class in a single grouped query) — a shape fix, not a new service. |
| Calendar 500/source caps (§8 #1) | 100 classes × sessions/timetable/assignments can exceed 500 in a cross-class window → **events silently vanish** from the timeline | Becomes a *correctness* issue at planning scale, not just perf. Fix: per-source caps with visible overflow indicators, or cursor pagination. |
| Dashboard per-class task counts (§8 #6) | ~100 `head:true` counts per student dashboard load | Noticeable on slow connections; fix alongside Action Center with the same aggregate RPC pattern. |
| Sync exports (§8 #3) | Still rare user actions; serverless handles moderate load, but a 100-class semes ter's leave PDF with embedded evidence is the most likely timeout candidate | Fix stays the same: `maxDuration` + pagination + (if proven) one export worker. |
| Cron push volume | Modest at this scale (100 classes, daily reminders) | No worker needed. |

**Revised verdict:** Hybrid split remains **not justified**; the first investments are
structural (aggregate RPCs, cap-overflow honesty, export `maxDuration`, observability,
scheduler replacement). MENTARI integration stays out of scope until API access exists.
The one still-undecided item with real teeth is **retention** (§13 #3): at 100 classes,
cascade deletes of attendance/leave history are no longer a theoretical loss — the
decision (soft-archive vs cascade) should be locked before any growth in data volume.

---

## 11. Recommended Architectural Direction

**Recommendation (not yet decided — pending §12 answers):** evolve as a **hardened
modular monolith**, not a Hybrid microservice split:

1. **Keep** Next.js (rendering + route handlers) + Supabase (Postgres/Auth/RLS/Storage) as
   the single platform. *(Fact: this is already the deployment target; only "never
   deployed" needs fixing.)*
2. **Fix the shapes before adding parts:** export pagination + streaming + `maxDuration`;
   parallelize the Action Center fan-out (or one aggregate RPC); cache role checks
   (`cache()` like `getSessionUser`); replace the GH-Actions cron with a proper scheduler
   (or move sub-daily jobs into `vercel.json`, which supports them).
3. **Re-sync docs** (ARCHITECTURE, DATABASE, SECURITY, DEPLOYMENT) with code reality —
   §9's contradictions (OCR default, service-role scope, retention jobs, review queue)
   are operational hazards.
4. **Add observability first** — it is the prerequisite for every later sizing decision.
5. **Re-evaluate the worker split only with dashboard evidence** (export duration p95,
   cron backlog age, push latency). The most plausible first extraction is export
   generation, not a general FastAPI tier.
6. **Treat MENTARI UNPAM as an external dependency with no current surface:** there is
   zero code for it; keep an adapter seam (like Google Calendar's) until official API
   access and authorization exist — per your own product note.

---

## 12. Missing Information and Questions for Me

Everything below could **not** be answered from the repository. The *(★)* items are the
four the auditor considers blocking for the Hybrid decision; the rest refine the plan.

| # | Question | Why it blocks the decision |
|---|---|---|
| ★1 | **What is the deployment reality?** `DEPLOYMENT.md` says nothing has ever been deployed. Is there a target date, a Vercel project, or a production DB? | Without it, "performance problems" are hypothetical; §10's verdict depends on scale. |
| ★2 | **Current + expected scale:** how many users, classes, assignments/term, attendance sessions/term? DB size? | Determines whether fan-outs (§8 #2) and sync exports (§8 #3) are theoretical or live fires. |
| ★3 | **MENTARI UNPAM status:** official API access granted? Auth model? Data scope (assignments? attendance? both)? | An external integration of that size would be the *first* legitimate driver for a service split — but it cannot be designed without the API contract. |
| ★4 | **Retention/data-destruction policy:** may user/class deletion really cascade-destroy attendance and leave history (§9 #2–3)? Is there an institutional retention requirement? | This is the highest-severity *confirmed* risk in the audit and a legal/compliance question, not an engineering one. |
| 5 | Export expectations: largest class size / semester rows? Is bulk export ever supposed to reach hundreds of thousands? | Sizes the worker-vs-route decision. |
| 6 | Background job volume: expected push messages/day at steady state? | Sizes the cron replacement. |
| 7 | Privacy/compliance regime: student data under any regulation (e.g. Indonesian PDP law)? Evidence/medical documents retention period? | Affects §9 #6 (bulk evidence export) and evidence retention. |
| 8 | Observability budget: is adding Sentry/OTel (free tiers exist) acceptable? | Prerequisite per §10. |
| 9 | Team/ops capacity: who runs the infra day-to-day? Vercel-only, or are you open to containers/VMs for a worker? | Determines whether "one worker later" is even operable. |
| 10 | The user-facing `createSupabaseAdminClient()` in `class-review-service.ts:92` — intentional or leftover? | Security review item (§6/§9). |
| 11 | Frontend-only decisions: no-Realtime is a product choice or an accident? (In-app inbox polling vs realtime would change the §10 answer.) | Affects whether websocket infra is ever needed. |
| 12 | Are `docs/ARCHITECTURE.md` et al. owned by you, or generated by a tool earlier? (Determines whether re-syncing docs is a task or a conflict.) | Process question (§9 stale docs). |
| 13 | Two attendance systems (`sessions` vs `attendance meetings`) — is merging them on the roadmap, or are both permanent? | Affects whether the attendance surface needs redesigning before any split. |

**Status (2026-11-04):** ★1 deployment = **production live** (docs claim is stale, to be
corrected); ★2 scale = **100 classes** (planning assumption); ★3 MENTARI = **deferred**;
★4 retention = **undecided** ("mungkin"). Items 5–13 remain open.

---

## 13. Prioritized Technical Risks

| Priority | Risk | Severity | Status |
|---|---|---|---|
| 1 | **Export timeout/OOM** on large classes (sync, in-memory, no `maxDuration`) | High | Confirmed |
| 2 | **Silent truncation** in exports + calendar at 500/1000-row caps (incomplete data, no signal) | High | Confirmed |
| 3 | **Cascade deletion** destroys attendance + leave history on user/class delete | High | Confirmed |
| 4 | Action Center `4N` fan-out scaling cliff | High | Confirmed |
| 5 | Sub-daily cron depends on never-observed GitHub Actions schedule (60-day auto-disable) | Medium | Confirmed |
| 6 | Member-writable `class_course_schedules` | High | Confirmed (intentional — needs product sign-off) |
| 7 | Docs claim OCR off while it is on (operator hazard) | Medium | Confirmed contradiction |
| 8 | Live DB correctness depends on **all 78 migrations applied in order** (RLS states changed across them) | Medium | Assumption — needs live-DB verification |
| 9 | Bulk PII export (leave reports incl. medical evidence) with no audit trail | Medium | Confirmed |
| 10 | Dual authorization surfaces + service-role outlier in user-facing code | Medium | Confirmed |
| 11 | No observability → all sizing decisions are blind | Medium | Confirmed |
| 12 | `USING (TRUE)` public-read policies become traps for future columns | Medium | Confirmed |
| 13 | Lecturer is free-text only — lecturer-side workflows cannot be enforced server-side | Low | Confirmed |

---

## Appendix — Methodology & Limitations

- **Method:** three parallel read-only agent passes (architecture/stack/perf; database/RLS/auth;
  feature-by-feature), then synthesis. All counts (78 migrations, 51 tables, 113 routes,
  78 pages, 273 components, 90 unit + 4 integration + 4 e2e tests) from filesystem/CLI, not docs.
- **Not verified:** the live database (env was not touched; migration-order correctness,
  actual row counts, and index adequacy on real data remain assumptions until a deployment
  environment is inspectable). CI/cron execution cannot be verified from the repo.
- **Facts vs opinion:** §2–9 are factual claims with evidence; §10–11 are recommendations that
  could be overturned by the §12 answers (notably ★1–★4).
