-- Speed up DM user search (QA perf): profiles.display_name substring search
-- (`ilike '%q%'`) cannot use a regular btree index because of the leading
-- wildcard, so every keystroke degenerated into a full table scan. A trigram
-- GIN index serves those queries fast while keeping substring matching.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles USING gin (display_name gin_trgm_ops);
