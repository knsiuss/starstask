-- One NIM may belong to exactly one account.
--
-- The index is on the normalized value so a NIM cannot dodge the constraint by
-- changing case or adding whitespace. It is partial: a profile created before
-- onboarding has no NIM yet and is exempt.
--
-- Existing duplicates are not deleted or rewritten here. If the table already
-- contains duplicates this migration stops with a short message; the operator
-- must correct the profile that holds the wrong NIM and run it again.
DO $$
BEGIN
  IF EXISTS (
    SELECT
      1
    FROM public.profiles
    WHERE nim IS NOT NULL
    GROUP BY lower(btrim(nim))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'profiles contains duplicate NIM values; correct them before applying 20261029003110';
  END IF;
END;
$$;


CREATE UNIQUE INDEX IF NOT EXISTS profiles_nim_unique ON public.profiles (lower(btrim(nim)))
WHERE
  nim IS NOT NULL;


COMMENT ON INDEX public.profiles_nim_unique IS 'One account per NIM, compared case-insensitively and trimmed. Partial: profiles without a NIM are exempt.';
