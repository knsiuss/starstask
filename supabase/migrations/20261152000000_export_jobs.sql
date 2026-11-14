-- Async export jobs (QStash): heavy file exports run in a background worker
-- instead of inside the browser request. The table is the single source of
-- truth for progress; the worker is idempotent — re-running a job with the
-- same id is a no-op for finished jobs.
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result_path text,
  error_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT export_jobs_status_check CHECK (status IN ('pending', 'running', 'done', 'failed'))
);


ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;


CREATE POLICY export_jobs_own ON public.export_jobs FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


REVOKE ALL ON TABLE public.export_jobs
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
  ON TABLE public.export_jobs TO authenticated;


CREATE INDEX IF NOT EXISTS export_jobs_user_created_idx ON public.export_jobs (user_id, created_at DESC);
