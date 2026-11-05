# Full Platform Performance Audit

Purpose: findings with evidence. Labels: **Confirmed** (seen in this session), **Suspected** (needs EXPLAIN/profiling in authorized env), **Architectural risk** (future-tenancy), **Future recommendation** (proposed).

## F-01 (P0, Confirmed) Fan-out per role, 78 pages × 113 APIs
- Where: `dashboard/page.tsx`, `dashboard/actions/page.tsx`, `classes/[slug]/page.tsx`, `lib/db/*` aggregate queries.
- Evidence: `Promise.all([listClassSubjects, listClassAttendanceMeetings, getClassAttendance])` in attendance page; Action Center merges assignment queue + `listManagedLeaveRequests` + `listClassAttendanceMeetings`.
- Impact: launch latency scales with class size/assignments; TTFB >800ms risk on large classes.
- Fix: server aggregation via RPC (`get_class_dashboard_stats`), single round-trip, `Suspense` streaming; priority P0.

## F-02 (P1, Suspected) RLS per-row membership checks
- Where: `supabase/migrations/*` policies + `listClassSubjects`, `getClassAttendance`, leave/assignment queries.
- Evidence: RLS policies + `can_manage_class` RPC patterns recurring; no EXPLAIN run in this audit (hypothesis until profiling).
- Impact: linear growth of policy cost with rows.
- Fix: single resolution function per request (`get_my_class_ids()`), index on `(class_id, user_id)`, security-definer minimal.

## F-03 (P1, Confirmed) Synchronous heavy exports/OCR
- Where: `attendance/exports/*`, `leave-requests/ocr`, `lib/ocr/schedule-parse.ts`, `exceljs`, `pdf-lib`, `unpdf`.
- Evidence: export routes build workbooks in-request; OCR parses in-request.
- Impact: request timeouts (Vercel Hobby ~10s), UX freeze.
- Fix: background job queue (DB jobs + cron), pending → done, download via signed URL. P1.

## F-04 (P1, Confirmed) Storage signed URLs per file operation
- Where: `/api/assignments/[id]/attachments*`, `/api/leave-requests/[id]/evidence*`, materials/media/avatar routes.
- Impact: per-file overhead; no bulk-signed flow.
- Fix: Cloudflare R2 + server-issued signed upload/download URLs (proposed, §09.10 diagram).

## F-05 (P2, Suspected) Router.refresh + polling on dashboards
- Where: `class-attendance-workspace.tsx` effect-driven refresh, `attendance-session-panel.tsx` fetch-on-open.
- Evidence: component reads (prior session): panels re-fetch detail; child client components re-render on parent state.
- Fix: optimistic updates + focused revalidation; avoid `router.refresh()` where targeted invalidation exists.

## F-06 (P1, Confirmed) Unbounded client lists without pagination in some surfaces
- Where: notification lists, assignment lists, leave history.
- Evidence: partial pagination exists (8/page in history tables) but some exports/notifications unbounded.
- Fix: enforce page size caps + incremental loading per spec §8.

## F-07 (P1, Architectural risk) Multi-tenancy absent
- Where: schema-wide (no `university_id` columns verified in `database.generated.ts` this audit — none observed).
- Impact: cannot onboard second university without migration; cross-tenant access risk if added via filters only.
- Fix: shared-schema + `university_id`, tenant-aware RLS, tenant context resolution (Phase 5–6).

## F-08 (P2, Future rec.) Redis cache for slow reads
- Where: dashboard stats, class metadata, assignment listings.
- Evidence: Upstash Redis installed but cache usage unverified end-to-end.
- Fix: selective caching with tenant-keyed entries; measure hit ratio before expanding.

## Validation that must run before treating Suspected as fact
- `EXPLAIN ANALYZE` on dashboard/action/attendance queries (dev branch via `supabase db execute` after authorization) + `pg_stat_statements` review.

Related: ROUTE_PERFORMANCE_MATRIX.md · DATABASE_RLS_AUDIT.md · HEAVY_OPERATIONS_AUDIT.md
