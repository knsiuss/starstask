-- Beta tester allowlist: users who receive unfinished features first.
-- This is deliberately NOT an authorization role: every route still
-- enforces its own permissions. The table has no client policies —
-- granting is a manual, audited operation (same posture as
-- platform_admins), and the app reads it only through is_beta_tester().
CREATE TABLE IF NOT EXISTS public.beta_testers (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  note text,
  CONSTRAINT beta_testers_note_length CHECK (
    note IS NULL
    OR char_length(btrim(note)) <= 200
  )
);


COMMENT ON TABLE public.beta_testers IS 'Beta tester allowlist. No client policies: granting is a manual, audited operation.';


CREATE OR REPLACE FUNCTION public.is_beta_tester () returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  exists (
    select
      1
    from
      public.beta_testers bt
    where
      bt.user_id = (
        select
          auth.uid ()
      )
  );
$$;


COMMENT ON function public.is_beta_tester () IS 'True when the caller is on the beta tester allowlist. Derived from auth.uid(), never from client input.';


REVOKE ALL ON function public.is_beta_tester ()
FROM
  public,
  anon;


GRANT
EXECUTE ON function public.is_beta_tester () TO authenticated;
