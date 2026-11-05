-- NIM per-university prefix (owner idea 2026-11-05: UNPAM-NIM, BRAWIJAYA-0000).
-- Legacy profiles.nim stays untouched (global unique, raw NIM).
-- student_identities.student_id becomes canonical prefixed form: {PREFIX}-{raw NIM}
-- Prefix source: universities.short_name, fallback code, fallback slug — uppercased alphanumeric.
-- This migration is additive: adds nim_prefix column, backfills student_id, adds per-university unique + format CHECK.
-- Rollback: restore student_id from profiles.nim via university_memberships join (see docs).

ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS nim_prefix text;

UPDATE public.universities
SET nim_prefix = upper(regexp_replace(coalesce(nullif(btrim(short_name),''), nullif(btrim(code),''), slug), '[^A-Za-z0-9]', '', 'g'))
WHERE nim_prefix IS NULL;

ALTER TABLE public.universities ADD CONSTRAINT universities_nim_prefix_format
  CHECK (nim_prefix IS NULL OR nim_prefix ~ '^[A-Z0-9]{2,20}$');

CREATE UNIQUE INDEX IF NOT EXISTS universities_nim_prefix_unique
  ON public.universities (nim_prefix) WHERE nim_prefix IS NOT NULL;

COMMENT ON COLUMN public.universities.nim_prefix IS 'Canonical NIM prefix for student_identities.student_id, e.g. UNPAM, BRAWIJAYA. Derived from short_name/code/slug. Owner decision 2026-11-05.';

-- Backfill prefixed student_id: UNPAM-241011400217
UPDATE public.student_identities i
SET student_id = u.nim_prefix || '-' || i.student_id
FROM public.universities u
WHERE u.id = i.university_id
  AND u.nim_prefix IS NOT NULL
  AND i.student_id NOT LIKE u.nim_prefix || '-%';

-- Existing CHECK student_identities_student_id_format already allows PREFIX-NIM
-- ('^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$'), e.g. UNPAM-241011400217. No new constraint needed.

CREATE UNIQUE INDEX IF NOT EXISTS student_identities_university_student_unique
  ON public.student_identities (university_id, lower(student_id));
