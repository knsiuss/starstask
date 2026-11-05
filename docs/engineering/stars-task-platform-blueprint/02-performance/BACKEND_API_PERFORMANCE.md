# Backend / API Performance

- 113 route files under `apps/web/src/app/api/**`; majority are thin handlers calling `lib/db/*` or RPCs with Zod validation.
- Parallelization: mixed — `Promise.all` in attendance page (good), sequential in some class flows (F-01).
- N+1 guard: previously fixed in `countPublishedAssignmentsBySubject` (merged single query, no N+1) — pattern to copy across classes/leave surfaces.
- Authentication/authorization repeated per request (session resolution in layouts + route-level checks) — move to middleware once with cached claims (Phase 1).
- External latency: Google Calendar sync, Geo/Maps link resolution (`/api/geo/resolve-maps-link`) — cache + timeout guards (Phase 2).
- Timeouts: no global timeout observed on heavy handlers — add per-route `maxDuration` equivalents via fetch abort (Future rec.).

Related: README.md · FULL_PLATFORM_PERFORMANCE_AUDIT.md
