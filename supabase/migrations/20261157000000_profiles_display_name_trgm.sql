-- Perf: trigram index for DM user search (ilike '%query%').
-- =====================================================================
-- searchUsers() matches profiles with ILIKE '%<query>%' — a leading
-- wildcard cannot use a B-tree index, so every keystroke seq-scanned
-- profiles. With 35 rows that is invisible (measured mean 0.19ms),
-- but it grows linearly with the user directory. pg_trgm makes
-- substring matching index-backed (GIN) so search stays fast at scale.
--
-- Rollback: DROP INDEX IF EXISTS public.profiles_display_name_trgm_idx;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx ON public.profiles USING gin (display_name gin_trgm_ops);
