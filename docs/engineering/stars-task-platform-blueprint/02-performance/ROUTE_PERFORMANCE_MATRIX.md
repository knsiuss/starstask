# Route Performance Matrix (excerpt — full matrix required before Phase 1)

Purpose: representative critical routes with observed data access patterns; extend rows during Phase 1 baseline.

| Route | Server data calls (verified) | Risk | Primary fix |
|---|---|---|---|
| `dashboard/page.tsx` | multiple class-scoped aggregates | High | RPC aggregation + Suspense streaming |
| `dashboard/actions/page.tsx` | assignment queue + leave managed + attendance meetings | High | parallel merge, pagination, pre-computed counts |
| `classes/[slug]/page.tsx` | class detail + members potential | Medium | cache class metadata, paginate members |
| `classes/[slug]/attendance/page.tsx` | `Promise.all([...])` 3 calls, verified line 84-88 pattern | Medium | preload + streaming, keep fixed panel fetch on-open |
| `sessions/[id]` | checkin location + roster | High on open | server geofence cache + incremental roster |
| `attendance/exports/*` | workbook build in-request | High | background jobs |
| `leave-requests/[id]/ocr` | unpdf parse in-request | High | background jobs |
| `assignments` | workspace queries with filters | Medium | keyset pagination + index (class/status/due) |

Related: FULL_PLATFORM_PERFORMANCE_AUDIT.md · IMPLEMENTATION_ROADMAP.md
