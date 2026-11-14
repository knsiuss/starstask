-- export_jobs: allow the enqueue half of the async export path.
-- =====================================================================
-- The web app creates export jobs with the user-scoped client
-- (apps/web/src/lib/db/export-jobs.ts, createExportJob), relying on RLS.
-- 20261152000000 revoked ALL on the table and granted only SELECT (owner),
-- so every enqueue fails with 42501 and async exports never run.
-- The worker still does all status writes via the service-role client
-- (getExportJobForWorker / markExportJobDone / markExportJobFailed), which
-- bypasses RLS by design; clients never need UPDATE/DELETE.
--
-- This grants exactly what createExportJob does: an INSERT as the caller's
-- own user_id, with column-level scope (kind/params only; id/status/
-- timestamps keep their defaults). UPDATE and DELETE stay denied to clients.
-- =====================================================================
GRANT INSERT (user_id, kind, params) ON public.export_jobs TO authenticated;


DROP POLICY IF EXISTS export_jobs_insert_own ON public.export_jobs;


CREATE POLICY export_jobs_insert_own ON public.export_jobs FOR INSERT TO authenticated
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


COMMENT ON TABLE public.export_jobs IS 'Async export queue. Writers: the owning client (INSERT own rows only: user_id, kind, params) and the service-role worker (status/result updates). Clients can never read other users'' jobs (SELECT owner-scoped) and never UPDATE/DELETE.';
