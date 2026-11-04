# StarsTask — Performance Audit & Architecture Discovery

> **Scope & method:** Read-only static investigation of the working tree (`apps/web`, `supabase/migrations`, `packages/*`). No source files modified, no dependencies installed, no DB migrated. **No performance metrics were measured** — no build trace, no browser trace, no `EXPLAIN ANALYZE`, no production logs were available in this session. Every "impact" below is therefore an **estimate derived from code structure**, not a measurement. Findings are labelled **Confirmed** (directly observed in code) or **Suspected** (structure suggests a problem, magnitude unproven).
>
> **Working-tree note (Confirmed):** `git status` shows pre-existing uncommitted user changes (schedule/import, onboarding, onboarding-init, `class-schedule.ts`, generated types, 3 new migrations). This audit describes the tree *as-is*, including those changes. Baseline lint/typecheck/build was **not** run (would write `.next/`/`node_modules` artifacts and the tree is dirty).

---

## 1. Current Performance Architecture

```
Browser (RSC-first Next.js 16.4.3 / React 19.3.1)
  ├─ Server Components (pages, layouts) — default
  ├─ Client islands: 145 "use client" files, Leaf forms/buttons
  └─ No SWR/React-Query cache layer; mutations via fetch + router.refresh()
        │
        ▼  (all route handlers: force-dynamic, Cache-Control: no-store)
Next.js API routes (113 files) + features/*-service.ts
        │
        ▼
Supabase: PostgREST (anon/user client, RLS) + RPC (SECURITY DEFINER)
          + Auth (GoTrue) + Storage (5 buckets)
        │
        ├─ Cron (maxDuration=60s): deadline-reminders, notification-events,
        │  session-jobs (push + Google Calendar sync, sequential)
        ├─ web-push (VAPID) per-device send
        ├─ Upstash Redis — rate limiting ONLY (lib/security/rate-limit.ts)
        └─ unpdf local text extraction (no cloud OCR)
```

**Key structural facts (Confirmed):**

| Fact | Evidence |
|---|---|
| RSC-first, client islands only at leaves | Only `error.tsx` files under `app/` are `"use client"`; pages are server components |
| Every page + API route is `force-dynamic` (185 files) | e.g. `app/(workspace)/dashboard/page.tsx:30`, all `app/api/**/route.ts` |
| Zero `unstable_cache`, zero `revalidate`, zero `generateStaticParams` | grep = 0 |
| Zero Server Actions (`"use server"`) | grep = 0; mutations = Route Handler → service → `lib/db/*` |
| Zero Supabase Realtime (`.channel(`, `postgres_changes`, publications) | grep = 0; CI excludes realtime |
| `getSessionUser` deduped per-request via React `cache()` | `lib/auth/session.ts:27` |
| No `select *` anywhere; column lists explicit | grep `select(*)` = 0 |
| Parallelism is the norm in data layer (`Promise.all` 105 sites) | layouts, Dashboard, Assignments, Attendance pages |
| Heavy libs server-only: `exceljs`, `pdf-lib`, `jszip`, `unpdf`, `web-push` | only imported from API routes / `features/*`, never from client components |
| Redis already present (Upstash) for rate limiting | `package.json:25-26`, `lib/security/rate-limit.ts:149-156` |
| No client Web-Vitals / RUM instrumentation | grep `web-vitals`, `reportWebVitals` = 0; only error capture in `instrumentation.ts` |

---

## 2. Confirmed Performance Bottlenecks

Ranked by expected impact. All **Confirmed** structure; magnitude **Suspected** until measured.

### B1 — Action Center: 1253-line page, 15 sequential awaits — **High**
- **Evidence:** `apps/web/src/app/(workspace)/dashboard/actions/page.tsx` (1253 lines). Independent queries run sequentially: `getClassActionCenter` (L341) → `getWorkspaceScope` (L342) → `listClassMembers` (L408) → `listClassAttendanceMeetings` (L412) → `loadAbsenceDetail` (L464) → `listClassSubjects` (L505). Only 1 `Promise.all` in the file.
- **Affected:** Action Center (lecturer inbox). Every load pays the sum of latencies instead of the max.
- **Impact (est.):** TTFB grows ~linearly with round-trips; worst page in the app.
- **Fix:** Parallelize independent awaits with `Promise.all`; split page into per-tab server components so only the active tab's queries run; add `loading.tsx` skeleton per tab (already exists at `actions/loading.tsx`).

### B2 — Per-class fan-out counts: 4×N round-trips per page load — **High**
- **Evidence:** `lib/db/class-actions.ts:60-107` — `Promise.all(classes.map(...))`, each class fires 4 head-count queries (`assignments`, `leave_requests`, `discussion_sessions`, `assignment_reports`). Same shape in `lib/db/dashboard.ts:350-352`, `lib/db/classes.ts:512-520`, and per-candidate RPC in `lib/db/attendance.ts:614-618`. Code itself acknowledges it: `dashboard.ts:347-349`.
- **Affected:** Dashboard, Action Center, My Classes.
- **Impact (est.):** A lecturer with 10 classes = 40 PostgREST round-trips per load; latency tail + Supabase egress/concurrency cost scale with class count, not user count.
- **Fix:** Single grouped RPC (`GROUP BY class_id` with conditional counts) returning all counts in one round-trip. This is the highest-leverage single DB change.

### B3 — Blocking XLSX/PDF generation in request path — **High**
- **Evidence:** `features/attendance-meetings/excel.ts:76-867` builds full workbooks in memory (`workbook.xlsx.writeBuffer()` at :867, plus an extra `new Uint8Array(bytes)` copy in `lib/api/responses.ts:52`). Data feeding it (`lib/db/attendance-meetings.ts:275-309`, `lib/db/leave.ts:634-655`) loads up to `.limit(500)` rows then rebuilds a matrix in memory. Export routes have **no `maxDuration`** and no streaming.
- **Affected:** Attendance exports (meeting/recap/checklist/report), leave CSV/PDF/ZIP export.
- **Impact (est.):** Function blocks for the full render; large class/semester exports risk platform timeout mid-render and high memory.
- **Fix (phased):** (1) Set `maxDuration` + `runtime="nodejs"` explicitly; stream rows into the workbook instead of materializing; (2) move to async job + signed-URL download only after measuring real export durations (see §11).

### B4 — Attendance live dashboard: 20s polling + double refresh — **High**
- **Evidence:** `components/attendance/attendance-meeting-dashboard.tsx:46,116,156,168-169,221-222` — 20s `setInterval` poll (`cache:no-store`) + `visibilitychange`/`focus` refresh + `await refresh()` **and** `router.refresh()` (full RSC re-render: layout session + page queries) after every mutation. No Realtime anywhere (0 `.channel(`). No `loading.tsx` for `attendance/*` pages.
- **Affected:** Attendance (live check-in roster).
- **Impact (est.):** Each open tab = 1 request/20s + full server re-render on every tab focus; N tabs multiply. Most likely source of duplicate/overlapping requests in the app.
- **Fix:** Single shared poller per tab with `document.hidden` backoff; drop the `router.refresh()` after client `refresh()` (one source of truth); consider Supabase Realtime `postgres_changes` only if polling cost is proven (see §9).

### B5 — RLS per-row predicate cost on list scans — **High**
- **Evidence:** `classes_read` calls `is_class_member(id) OR can_manage_class(id)` per class row, where `can_manage_class` = 2 more definer lookups (`20261029001200_class_rls.sql:66-73`, `20261029001100_class_functions.sql:70-76`). Session policies call `can_view_session(id)` per row + nested `can_manage_class(session_class_id(...))` (`20261029001800_session_rls.sql:82-115`). Storage review policy parses object path + 2 definer calls per row (`20261029001200_class_rls.sql:368-385`). Leave evidence/history policies call `can_view_leave_request(request_id)` per row (`20261029002400_leave_rls.sql:43-72`).
- **Affected:** Class discovery lists, Sessions, Leave evidence lists, Storage listing.
- **Impact (est.):** List queries degrade super-linearly with row count; the cost is invisible in app code.
- **Fix:** Verify with `EXPLAIN ANALYZE` on the exact list queries; then flatten predicates (e.g. membership via a single indexed `EXISTS`, or a materialized membership view) — **do not** rewrite policies blindly.

### B6 — Developer user directory: full auth-user scan per request — **High** (but admin-only)
- **Evidence:** `lib/db/developer.ts:384-457` — paginates **every** auth user into memory via `admin.auth.admin.listUsers`, then filters/sorts/paginates in JS. Route is `force-dynamic` (`app/api/developer/users/route.ts:13`).
- **Affected:** Developer console only.
- **Impact (est.):** Cost ∝ total registered users on every hit; first to break as user base grows.
- **Fix:** Server-side search (RPC over `auth.users`/`profiles` with `ILIKE` + index, or a `profiles` mirror table), paginate in SQL.

### B7 — Push cron: sequential claims inside a 60s budget — **Medium-High**
- **Evidence:** `lib/push/scheduler.ts:145-191` — sequential `await completeDelivery` per claim; per-device sends are parallel (`Promise.all`) but each claim = push RTT (10s timeout, `lib/push/sender.ts:37,113-130`) + 1–2 DB writes, serialized. Cron `maxDuration=60` (`app/api/cron/deadline-reminders/route.ts:12`), `limit:100`. Session-jobs runs reminders then calendar sync sequentially in the same window (`app/api/cron/session-jobs/route.ts:56-71`).
- **Affected:** Deadline reminders, notification events.
- **Impact (est.):** At 100 claims, worst case ≈ 100 × (push + writes) serially vs 60s budget; one slow push endpoint burns the window.
- **Fix:** Bounded concurrency (`Promise.allSettled` with limit ~10) across claims; split reminder and calendar phases into separate cron invocations.

### B8 — Google Calendar sync: sequential external I/O — **Medium**
- **Evidence:** `features/integrations/google-calendar-service.ts:595-638` — `for (const row of data) await syncSessionForUser(...)` (L625-626), each involving token refresh + Google API calls, inside the same 60s cron window, `limit=20`.
- **Affected:** Session calendar sync.
- **Impact (est.):** 20 × (token + API RTT) serially; external latency fully exposed.
- **Fix:** Bounded-concurrency batching; separate cron from push reminders.

### B9 — OCR in upload request path — **Medium** (mitigated by design)
- **Evidence:** `features/leave/evidence-service.ts:160-203` downloads the **entire blob** (`:176-178`), `arrayBuffer()` (`:185`), then `unpdf extractText({mergePages:true})` (`lib/ocr/pdf-text.ts:27`). Awaited from upload flow (`evidence-service.ts`) and schedule import (`app/api/classes/[slug]/schedule/import/route.ts:82`). No `maxDuration`, no size cap at call sites. Provider is local text-layer only — no cloud OCR latency (good choice, correctly scoped).
- **Affected:** Leave evidence upload, schedule PDF import.
- **Impact (est.):** Upload latency + memory spike ∝ PDF size; scanned PDFs correctly return `unsupported`.
- **Fix:** Cap bytes before parse; set `maxDuration`; defer extraction to post-upload only if upload p95 is proven slow.

### B10 — Blanket `force-dynamic` + `router.refresh()` everywhere — **Medium (systemic)**
- **Evidence:** 185 files with `export const dynamic = "force-dynamic"` (every page + every API route); 85 `router.refresh()` calls / 65 files; `useTransition` in only 1 file. Zero `revalidate`/`unstable_cache`.
- **Affected:** All navigation and mutations.
- **Impact (est.):** Every navigation/mutation = full server re-render + re-query; zero RSC cache benefit. This is the largest *systemic* cost multiplier behind B1/B2/B4.
- **Fix:** Keep `force-dynamic` for authed/mutating routes; selectively cache public reads (`getPublishedCounts`, `getSemesterOptions`, public class browse) with `unstable_cache` + short TTL, and scope already-existing `revalidatePath` calls to the mutations that need them.

---

## 3. Potential Performance Risks (Suspected — needs measurement to confirm)

| # | Risk | Evidence | Severity |
|---|---|---|---|
| R1 | `lucide-react` barrel cost (253 importing files, no `optimizePackageImports`) | `next.config.ts:22-82` has no bundle opts; `package.json:31` | Medium — Suspected |
| R2 | Server cold-start/memory from static `exceljs`/`pdf-lib`/`jszip`/`unpdf` imports in route bundles | 6 import sites, no `next/dynamic` (0) | Medium — Suspected |
| R3 | `dashboard.ts` `getMyWeek` vs `getNextSchedule` duplicate queries | Code comment admits same sources (`components/dashboard/next-schedule.tsx:34`) | Medium — Suspected |
| R4 | Per-row 60s timers (`explore-assignment-row`, `live-deadline-badge`, `dashboard-header`) | `explore-assignment-row.tsx:22,92`, `live-deadline-badge.tsx:35,63`, `dashboard-header.tsx:128` | Low — Confirmed pattern, unmeasured impact |
| R5 | `count(*) OVER ()` totals on 10 list RPCs force full filtered counts | Migrations listed in §6 | Medium — Confirmed structure |
| R6 | `developer_class_metrics` correlated counts × up to 500 classes | `20261031200000_developer_class_metrics.sql:36-73` | High but gated to service_role — Confirmed |
| R7 | `notify_session_participants` per-participant loop on every session write | `20261029001700_session_functions.sql:122-141` | High — Confirmed structure |
| R8 | No virtualization anywhere; 598 `.map(` renders; tables in 12 files | grep virtualization = 0 | Medium — Confirmed absence |
| R9 | Missing `loading.tsx` for `attendance/*`, `schedule`, `notifications`, `submit`, `leave-requests/[id]` etc. | 27 loading/error files; gaps listed in §4 | Medium — Confirmed |
| R10 | `getSemesterOptions` fetch-1000-to-dedupe in JS | `lib/db/assignments.ts:430-452` | Low-Medium — Confirmed |
| R11 | `.limit(500/1000)` full-row loads + in-memory join/filter | `class-attendance.ts:197,224,255`, `attendance.ts:265`, `leave.ts:601-623`, `classes.ts:585,708` | Medium — Confirmed structure |
| R12 | `class_invitation_acceptances.user_id` no leading index | Proven by `.eq("user_id")` in `dashboard.ts:833-836`; unique key is `(invitation_id, user_id)` | Medium — Confirmed, single justified index candidate |
| R13 | `notification_deliveries.assignment_id` leading-index gap | No proven filter pattern found | Low — Suspected, do not index yet |
| R14 | `docs/DATABASE.md` drift (missing later migrations/indexes) | §3 index list stops early | Low — Confirmed |

---

## 4. Frontend Performance Analysis

**Confirmed-good (don't regress):**
- Pages are Server Components; client code is leaf islands (145 `"use client"` files, concentrated in `components/classes` 25, `components/attendance` 18, `components/assignments` 16).
- `getSessionUser` is React-`cache()` deduped (`lib/auth/session.ts:27`); layout parallelizes with `Promise.all` (`app/(workspace)/layout.tsx:30-40`).
- No `useEffect(fetch)` data fetching; no client cache layer to go stale.
- Browser Supabase client is a singleton (`lib/supabase/client.ts:9-25`).
- Heavy libs never reach the client bundle; `next/image` with `remotePatterns`; raw `<img>` only for blob URLs (3 files).
- Pagination exists on list endpoints (`.range()` in `assignments.ts:262`, `admin.ts:275`, `leave.ts`, `verification.ts`).

**Problems (Confirmed unless noted):**
1. **Action Center page** — see B1. Largest file (1253 lines), most sequential awaits.
2. **Attendance dashboard client** — see B4. Worst client-side pattern in the app.
3. **Oversized client components** — `leave-form.tsx` (1023), `assignment-form.tsx` (957), `attendance-meeting-dashboard.tsx` (621), `request-publication-dialog.tsx` (614), `student-meeting-list.tsx` (596). Whole file ships as client JS. Split by tab/section; move static subtrees to server components.
4. **Oversized server pages** — `schedule/page.tsx` (857), `assignments/[id]/page.tsx` (670), `sessions/[id]/page.tsx` (643), `leave-requests/[id]/page.tsx` (623). First-render/TTFB cost.
5. **108 files >250 lines** (repo's own split guidance is ~250, `AGENTS.md §5.2`); ~50 files >400 lines.
6. **No code-splitting** — `next/dynamic` = 0, `React.lazy` = 0. Heavy dialogs/forms load with the page.
7. **Missing loading states** — no ancestor `loading.tsx` for `(workspace)/attendance`, `schedule`, `notifications`, `submit`, `classes/join`, `leave-requests/[id]|new|edit`, `(site)/classes/[slug]`, `(onboarding)`. Full-page wait on those routes.
8. **Suspense in only 2 files** — streaming is essentially unused; TTFB = full page time.
9. **`lucide-react` in 253 files** with no `experimental.optimizePackageImports` — Suspected barrel cost (R1).
10. **No virtualization** — `Assignments` Requests tabs render capped-at-50 lists as full DOM; `student-meeting-list`, `timeline-board` (691), `class-attendance-history-table` render unbounded rosters.
11. **No `next/font`** — likely system stack (fine), but unmeasured; no `priority`/`sizes` on `next/image` (14 files).
12. **Mutations not wrapped in `useTransition`** (1 file only) — `router.refresh()` blocks UI.

**Per-focus-area verdicts:**

| Area | Verdict |
|---|---|
| Dashboard (`dashboard/page.tsx:88-102`) | Good top-level `Promise.all`; Suspected duplicate `getMyWeek`/`getNextSchedule` work (R3); 60s header/badge timers. **Low-Medium** |
| Assignments | Paginated schedule + good `Promise.all`; Requests tabs capped-50 unpaginated DOM; heavy client forms; per-row timers. **Medium** |
| Attendance | Worst client perf (B4); server side parallelizes well. **High** |
| Absence Requests | Paginated server-side (good); sequential session→class→role→list chain (partly inherent); 1023-line client form; exports are server routes (good). **Medium** |
| Action Center | See B1. **High** |
| My Classes | Single query capped at 100 rows, in-memory search/sort — fine now, cliff >100 memberships. **Low now** |

---

## 5. Backend Performance Analysis

**Inventory (Confirmed):** 113 API route files; **0 Server Actions**; largest data modules `classes.ts` (1723), `dashboard.ts` (1138), `leave.ts` (1086), `attendance.ts` (983), `assignments.ts` (753). No `select *`; no true per-row N+1 (joins use `.in("id", ids)` batching); no `unstable_cache`.

**Ranked expensive operations:** see §2 (B1–B3, B6–B11). Summary:

| Rank | Operation | Location | Severity |
|---|---|---|---|
| 1 | Full auth-user scan + in-memory filter/sort | `lib/db/developer.ts:384-457` | High |
| 2 | 4×N / N× count & RPC fan-out per page load | `class-actions.ts:60-107`, `dashboard.ts:350`, `classes.ts:512`, `attendance.ts:614` | High |
| 3 | In-memory XLSX/PDF render, no `maxDuration`/streaming | `features/attendance-meetings/excel.ts:867`, `pdf.ts` | High |
| 4 | Sequential push claims in 60s cron budget | `lib/push/scheduler.ts:145-191` | Medium-High |
| 5 | Sequential Google Calendar syncs, same cron window | `google-calendar-service.ts:625-626` | Medium |
| 6 | Full-blob PDF parse in upload/import request | `evidence-service.ts:176-196`, `schedule/import/route.ts:82` | Medium |
| 7 | fetch-1000 dedupe; per-call admin client recreation; missing `maxDuration` on export/OCR | `assignments.ts:430-452`, `lib/supabase/admin.ts:22-37` | Low-Medium |

**Other backend findings (Confirmed):**
- **Supabase client creation is correct where it matters.** Server client is per-request by design (`@supabase/ssr` cookies, `lib/supabase/server.ts:17-37`) — cheap, no I/O at construction, **not** a singleton anti-pattern. Admin client recreated per call (`lib/supabase/admin.ts:22-37`) is harmless churn but loses connection reuse within a cron run — Low.
- **Auth dedupe bypass:** `class-submission-service.ts:179,278` call `supabase.auth.getUser()` directly instead of cached `getSessionUser()` — extra Auth round-trip per call. Low, Suspected impact.
- **Sequential-await candidate:** `lib/db/class-schedule.ts:263-265` awaits `requireSubjectInClass` per distinct subject in a loop — convert to `Promise.all`. Confirmed.
- **Responses:** `apiSuccess`/`apiError` always `no-store`; public payloads rarely use `s-maxage` 60s (`lib/api/responses.ts:28-38`); downloads always `no-store` (appropriate for attendance/medical exports).
- **`maxDuration` only on 5 cron routes** — export/OCR/import routes rely on platform default timeout. Confirmed gap, Medium.

---

## 6. Database Performance Analysis

**Inventory (Confirmed):** 51 tables, 96 indexes, 111 RLS policies, 41 triggers, **0 views, 0 realtime publications**. Storage: 5 buckets (3 private, 2 intentionally public: `avatars`, `class-media`).

**Well-covered (verified, no action):** `assignments` (6 core + class/review/subject indexes), `leave_requests` (5+ indexes), `discussion_sessions` (class/upcoming/organizer/assignment/meeting/open), `assignment_completions` (PK + user index covers the actual query), `leave_request_forwarding_items` (unique + forwarding indexes cover the actual query).

**RLS complexity — the real DB risk (Confirmed):** see B5. ~180 `auth.uid()` hits are inside `SECURITY DEFINER` functions (single evaluation, fine); the unwrapped pattern appears only in 2 policies (`20261029003300_class_subjects_and_permissions.sql:175,180` — Low). Recursive-looking predicates (`is_class_member` querying `class_members`) are mitigated by `SECURITY DEFINER` — cost is double evaluation, not correctness (Medium, Suspected).

**Count queries & expensive functions (Confirmed):**
- `count(*) OVER ()` pagination totals: 10 RPC sites (list pages pay a full filtered count each) — Medium.
- `developer_class_metrics`: 8 correlated counts + 2 max per class × up to 500 classes — High but service-role gated.
- `get_platform_admin_overview`: ~10 sequential counts — Medium.
- `delete_class` pre-check + summary RPC: 10 sequential counts each — Medium.
- `notify_session_participants`: per-participant insert loop on every session update/cancel — High (B/R7).
- `notify_class_leave_reviewers`, `notify_platform_admins_public_assignment` (on every public assignment insert): loops — Medium.
- `developer_database_health`: `unnest` + per-table count loop — Medium, developer-only.
- ~25 of 41 triggers are `set_updated_at` housekeeping — negligible.

**Index recommendation — exactly one justified (Confirmed linkage):**
- `class_invitation_acceptances(user_id, invitation_id)` — proven by `dashboard.ts:833-836` (`.eq("user_id")` first, unique key leads with `invitation_id`). **Medium.**
- All other FK gaps (`notification_deliveries.assignment_id`, SET-NULL audit FKs, partial-index coverage) lack a proven `.from()` filter pattern — reported as Suspected; **do not index without `EXPLAIN` proof.**

**Realtime overhead:** none — no publications, no channels. Confirmed absent.

---

## 7. Heavy Operations Analysis

| Operation | Blocks request/UI today? | Evidence | Recommendation |
|---|---|---|---|
| XLSX generation (attendance) | **Yes — full render in request** | `excel.ts:867`, no `maxDuration`, no streaming | Stream + `maxDuration` now; async job later only if measured slow |
| PDF generation (attendance, leave) | **Yes** | `pdf.ts`, `leave/reports/pdf.ts:651`, `leave-requests/export/route.ts:110-152` | Same as XLSX |
| Attendance reports/recap | **Yes** | `attendance-meetings.ts:275-309` matrix rebuild | Pre-aggregate via RPC; cache recap per meeting version |
| Bulk schedule import (PDF) | **Yes** | `schedule/import/route.ts:82` awaits OCR + parse | Cap size, `maxDuration`; staged import (parse → preview → commit) already fits async naturally |
| Notification delivery (web-push) | **No (cron)** — but cron is the bottleneck | `lib/push/scheduler.ts` sequential claims, 60s budget | Bounded concurrency; split cron phases |
| Google Calendar sync | **No (cron)** — sequential within cron | `google-calendar-service.ts:625-626` | Bounded concurrency; separate cron |
| OCR (leave evidence) | **Yes — in upload request** | `evidence-service.ts:176-196` | Cap + `maxDuration` now; defer only if p95 proven slow |
| ZIP export (leave reports) | **Yes** | `leave/reports/zip.ts:3` (`jszip`) | Same as XLSX |
| Future MENTARI sync | N/A — no code exists | No references found | Design as async job from day one (external system, unknown latency) |

**Judgement:** Nothing today *requires* a job queue. The blocking operations are blocking because of **missing streaming/caps/concurrency**, not because they fundamentally need a queue. Introduce a queue only when a measured operation exceeds the platform timeout or harms interactive latency (see §11 thresholds).

---

## 8. Recommended Optimizations

### P0 — Do first (high impact, low risk, no new infra)

| # | Change | Addresses | Est. impact |
|---|---|---|---|
| P0-1 | Parallelize Action Center independent awaits (`Promise.all`); split per-tab server components | B1 | Action Center TTFB ↓ (sum → max) |
| P0-2 | Grouped counts RPC (`GROUP BY class_id`, conditional counts) replacing 4×N head counts | B2 | Dashboard/Action Center: N×4 → 1 round-trip |
| P0-3 | Attendance dashboard: single poller, `document.hidden` backoff, drop redundant `router.refresh()` | B4 | Request volume ↓; no more double-refresh |
| P0-4 | `EXPLAIN ANALYZE` on `classes_read`, session, leave, storage list queries; flatten proven-hot RLS predicates | B5 | List-query latency at scale |
| P0-5 | Set `maxDuration` + `runtime="nodejs"` on all export/OCR/import routes; cap OCR bytes | B3, B9 | Removes platform-timeout risk |
| P0-6 | Bounded concurrency for push claims + calendar sync; split cron phases | B7, B8 | Cron completes within 60s at 100+ claims |
| P0-7 | `class_invitation_acceptances(user_id, invitation_id)` index (single justified index) | R12 | Dashboard invitations query |
| P0-8 | Convert `class-schedule.ts:263-265` loop to `Promise.all` | §5 | Schedule import latency |

### P1 — Do next (medium effort)

| # | Change | Addresses |
|---|---|---|
| P1-1 | `loading.tsx` for missing routes; `<Suspense>` streaming on Action Center tabs, attendance, schedule | §4 |
| P1-2 | `next/dynamic` for heavy dialogs/forms (`leave-form`, `assignment-form`, publication dialog); `optimizePackageImports` for `lucide-react` | §4 |
| P1-3 | Split files >400 lines (forms, `lib/db/classes.ts`, `leave.ts`, `dashboard.ts`) | §4, §5 |
| P1-4 | Stream XLSX/PDF generation; pre-aggregate attendance recap | B3 |
| P1-5 | `unstable_cache` (short TTL) for public reads: `getPublishedCounts`, `getSemesterOptions`, public browse | B10 |
| P1-6 | Server-side search for developer user directory (replace full scan) | B6 |
| P1-7 | Virtualize rosters/history tables (`student-meeting-list`, attendance history, timeline) | R8 |
| P1-8 | `count(*) OVER ()` → estimated counts or separate count query where exact totals aren't needed | R5 |

### P2 — Only if measured (do not do preemptively)

| # | Change | Trigger to justify |
|---|---|---|
| P2-1 | Supabase Realtime for attendance roster | Polling proven expensive (request volume / DB load) |
| P2-2 | Job queue (e.g. pg-boss / Trigger.dev) for exports | Export p95 > platform timeout or >5s p95 |
| P2-3 | Redis caching beyond rate limiting | Cache-hit ratio measurable; DB CPU saturated |
| P2-4 | FastAPI service | A measured Python/ML workload exists (none today) |

---

## 9. Hybrid Architecture Proposal

**Verdict: the current stack is not the problem. The problems are query shape, request-path blocking, and missing parallelism — all fixable inside Next.js + Supabase. No new service is justified by the evidence.**

| Technology | Problem it would solve | Bottleneck it addresses | Why existing stack is / isn't insufficient | Operational overhead | Simpler alternative |
|---|---|---|---|---|---|
| **Next.js (keep)** | Full-stack RSC + route handlers | — | Sufficient; RSC-first already correct | None (existing) | — |
| **Supabase PostgreSQL + Auth + RLS (keep)** | Data, auth, storage, row security | — | Sufficient; risk is predicate/query shape, not the engine | None (existing) | Grouped RPCs + selective index + predicate flattening |
| **FastAPI** | Python compute (none exists) | **None identified** | No Python, no ML, no heavy CPU work in repo; would add network hop + auth duplication for zero gain | New deploy, secrets, monitoring, CORS/auth bridge | **Do not introduce.** Revisit only if MENTARI sync needs Python ETL |
| **Background workers** | Offload blocking work | B3 (exports), B9 (OCR) — only if measured | Cron already exists for push/calendar; exports are request-scoped today | Worker lifecycle, retries, dead-letters, observability | Stream + `maxDuration` + caps first (P0-5, P1-4) |
| **Redis (Upstash — already present)** | Rate limiting (done); optional caching | Public reads (B10) | Already paid for; incremental cost ≈ 0 | Negligible | Use existing Upstash for `unstable_cache`-backed public reads only; no new Redis |
| **Job queue** | Async exports/notifications | None proven | Cron covers scheduled work; exports fit in request today | Queue infra + worker + status UX | Cron (existing) + streaming; add queue only past measured thresholds |

**Proposed hybrid (minimal, evidence-driven):**
1. **Next.js + Supabase (unchanged)** with P0/P1 fixes — this alone should deliver the bulk of the speedup.
2. **Existing cron** split into parallel phases (push / calendar / retention) with bounded concurrency.
3. **Upstash Redis (existing)** extended from rate-limiting to short-TTL public-read caching — no new vendor.
4. **Async export path (deferred):** if §11 measurement shows exports exceeding timeouts, add a single queue (e.g. pg-boss on the existing Postgres — no new infra) with signed-URL delivery.
5. **MENTARI sync (future):** design as an async job from day one; the only justified future worker.

**Explicitly not recommended:** microservices, FastAPI, standalone Redis, or a rewrite. None are supported by the evidence.

---

## 10. Infrastructure and Cost Implications

**Current cost posture (Confirmed from repo):** Supabase (Postgres/Auth/Storage) + Vercel/Next hosting + Upstash (rate limiting) + Google OAuth/Calendar APIs (free tier) + web-push (free). No dedicated workers, no Redis beyond Upstash, no FastAPI hosting.

| Change | Infra cost delta | Notes |
|---|---|---|
| P0/P1 (all in-stack) | **≈ $0** | Fewer round-trips also reduce Supabase egress/compute — likely a net saving |
| Upstash caching for public reads | Negligible (existing plan) | Watch request volume, not memory |
| Async export queue (deferred) | Small | pg-boss reuses existing Postgres; worker = one more Vercel cron/job slot |
| FastAPI / microservices (not recommended) | Significant | New hosting, secrets, TLS, monitoring, on-call surface — unjustified |
| Supabase scale tier | Only if measured | DB CPU/IO saturation at §11 thresholds would justify; query fixes should come first |

---

## 11. Performance Benchmarking Plan

**Currently available (Confirmed):**
- Error capture (`instrumentation.ts` → `app_error_events` with route template/method/digest only).
- Activity/monitoring tables (`app_activity_events`, `auth_activity_events`, `developer_incidents`) — **no duration/timing columns found** (grep `durationMs|elapsed` = 0 in `lib/`).
- Vitest + Playwright + axe-core in `package.json` — functional/a11y, **not** performance.
- No Web-Vitals/RUM, no bundle trace, no query-timing instrumentation.

**Missing (Confirmed):** LCP/INP/CLS, API latency percentiles, DB query timings, export durations, cron runtimes.

**Do not invent results.** The plan below produces the first real numbers.

### Step 0 — Instrument (before optimizing, 1–2 days)
1. Add `web-vitals` reporting to a client beacon → `app_activity_events` (or a dedicated `perf_events` table): route, LCP, INP, CLS, TTFB.
2. Wrap `lib/db/*` calls with timing logs (route, function, ms) — or enable Supabase `pg_stat_statements` + slow-query log.
3. Log cron phase durations and claim counts; log export render durations + row counts.
4. Record `next build` bundle sizes per route (route-level first-load JS).

### Step 1 — Baseline (measure before changing anything)
| Benchmark | Method | Target to compare after P0 |
|---|---|---|
| Initial page load / LCP | Lighthouse + RUM p75, 3 routes (Dashboard, Assignments, Action Center) | LCP p75 < 2.5s |
| INP | RUM p75 on attendance + forms | INP p75 < 200ms |
| CLS | RUM p75 | CLS p75 < 0.1 |
| API latency | Server timing logs p50/p95 per route | p95 < 500ms interactive routes |
| DB query time | `pg_stat_statements` top-20 by total time + `EXPLAIN ANALYZE` on B5 queries | Top query total time ↓ ≥50% |
| Dashboard load | RUM + server timing | p95 TTFB < 800ms |
| Attendance history load | RUM + server timing, 100/500/1000-row fixtures | p95 < 1s at 1000 rows |
| Action Center load | RUM + server timing (10-class lecturer fixture) | p95 TTFB < 800ms |
| XLSX export duration | Server timing, 50/200/1000-student fixtures | p95 < 5s or move async |

### Step 2 — Load scenarios (planning only, not capacity claims)
| Concurrent users | Likely bottleneck (Suspected) | Infra change needed *if* it materializes |
|---|---|---|
| 100 | Action Center TTFB (B1), 4×N counts (B2) | P0 fixes only; no infra change |
| 500 | RLS list scans (B5), `count(*) OVER ()` (R5), polling volume (B4) | Predicate flattening + P0-3; Supabase compute tier review |
| 1,000 | PostgREST round-trip multiplier (B2), cron budget (B7) | Grouped RPCs (P0-2) + cron split; connection pooling review |
| 5,000 | Everything above + storage/RPC saturation | Only then: read replicas / caching layer / queue — **none justified today** |

### Step 3 — Regression gates
- Playwright perf smoke (Lighthouse CI) on Dashboard/Action Center/Attendance in CI.
- Query-count assertion per page load (fail if round-trips grow).
- Cron runtime budget alert at >45s of 60s.

---

## 12. Missing Information and Questions

**What I could not verify from the repo alone:**
1. Production traffic, user/class counts, and Supabase plan/tier.
2. Vercel region(s), function timeout/memory settings, and current p95 latencies.
3. `EXPLAIN ANALYZE` plans for the B5 RLS list queries.
4. Real export sizes/durations (largest class, largest semester).
5. Push subscription counts and cron runtime history.
6. Whether `@upstash/redis` is already used beyond rate limiting / in production.
7. The intended scale target (campus-wide? multi-campus?) and MENTARI sync scope/timing.

---

## Most Important Questions (please answer to complete this investigation)

1. **What are the real numbers today?** Approx. registered users, active classes, largest class size, and daily traffic — and may I have (anonymized) Supabase query stats (`pg_stat_statements`) + Vercel function duration logs? Without them, all impacts remain estimates.
2. **Where does it feel slow?** Which 2–3 pages/actions do users complain about most (Action Center, attendance, exports, something else)? This sets the P0 order.
3. **What is the target scale and timeline?** E.g. "1,000 concurrent campus users this semester" vs "pilot with 100" — it determines whether P0 alone suffices or §9 step 4 is needed.
4. **Are exports/OCR allowed to become async (job + download link)?** Or must they stay synchronous downloads? This decides whether a queue is ever justified.
5. **May I run `EXPLAIN ANALYZE` against a staging copy of the DB** (read-only) for the RLS list queries in B5? This is the single most valuable missing measurement for the database findings.

---

### Traceability note

- Frontend counts (145 client files, 185 `force-dynamic`, 0 `next/dynamic`, 0 realtime, 108 files >250 lines): grep + line counts over `apps/web/src`.
- Backend counts (113 routes, 0 Server Actions, 0 `select *`, 0 `unstable_cache`): glob + grep over `apps/web/src`.
- Database counts (51 tables, 96 indexes, 111 policies, 41 triggers, 0 views/publications): grep over `supabase/migrations/*.sql` (72 files).
- File paths above are relative to `C:\project\Startask` unless stated; line numbers are from the current working tree (dirty, see scope note).
- No benchmark results are claimed; all magnitudes are structural estimates pending §11 measurement.
