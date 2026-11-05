# Assumptions & Limitations

- This audit is documentation-only; no code, migration, RLS, dependency, or deployment changes were made.
- Counts (78 pages, 113 API routes, 78 migrations) are from the working tree at audit time and must be re-verified before Phase 1.
- Performance claims are hypotheses unless labelled Confirmed with file:line evidence; EXPLAIN/profiling in an authorized env is required before index work.
- Free-tier quotas are to be re-verified against official vendor docs at Phase 0/4; no pricing article was relied upon.
- Multi-tenant entities are **proposed**; existing schema has no `university_id` (verified by absence in inventory this session, but full column walk not performed — label kept).
- No production load tests were run; capacity envelope at 5k is unknown.

Related: README.md · AUDIT: FULL_PLATFORM_PERFORMANCE_AUDIT.md
