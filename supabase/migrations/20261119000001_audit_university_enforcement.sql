-- Production-Scale Hardening Plan §4 — audit_logs university enforcement.
--
-- Additive ONLY. Expand-contract step 1 of 3: make the gap visible and
-- stop new NULLs at the application layer; do NOT flip NOT NULL yet.
--
-- STOP PANEL — read before pushing anywhere:
--   * Local stack measured 2026-11-05: 76 audit_logs rows, 76 with
--     university_id IS NULL, 0 non-null. Production counts are NOT
--     verified in this pass (no production session used).
--   * Do NOT run the NOT NULL statement below until the NULL count is
--     zero in the target environment AND a backfill decision is
--     explicitly approved. Backfilling a tenant key onto historical
--     audit rows without a business rule would be inventing data.
--   * The append-only immutability trigger shipped in
--     20261119000000_phase5l_security_hardening.sql
--     (audit_logs_prevent_mutation_trg, verified present locally).
-- Monitoring view: count of audit rows missing a tenant key, per day.
-- Intended for the observability dashboard (plan §4) and for deciding
-- when expand-contract step 2 (writer-side enforcement) may proceed.
CREATE OR REPLACE VIEW public.audit_logs_university_gap AS
SELECT
  date_trunc('day', created_at) AS DAY,
  count(*) AS null_university_rows
FROM
  public.audit_logs
WHERE
  university_id IS NULL
GROUP BY
  1
ORDER BY
  1 DESC;


COMMENT ON VIEW public.audit_logs_university_gap IS 'Hardening §4 expand-contract step 1: rows missing university_id. Zero must be confirmed in the target env before NOT NULL (step 3) is approved.';


-- Document the contract for future writers (no enforcement change here):
COMMENT ON COLUMN public.audit_logs.university_id IS 'Tenant key; nullable historically (76/76 local rows NULL). New writers SHOULD populate it; NOT NULL is intentionally deferred until a verified zero-NULL state plus explicit approval.';


-- ---------------------------------------------------------------------------
-- EXPAND-CONTRACT STEP 3 (DO NOT RUN without explicit approval):
--   ALTER TABLE public.audit_logs
--     ALTER COLUMN university_id SET NOT NULL;
-- Preconditions: SELECT count(*) FROM public.audit_logs
-- WHERE university_id IS NULL  =>  0 in the target environment,
-- plus an approved backfill/retention decision for historical rows.
-- ---------------------------------------------------------------------------
-- Retention posture (plan §4): monthly partition or purge job is a
-- product decision, not a migration here. Recorded as a blocker in
-- docs/architecture/phase-5i/production-scale-hardening-implementation.md.
