-- Development seed data only.
--
-- Loaded by `supabase db reset` / `supabase start` because it lives in
-- supabase/seed.sql. It is NEVER applied by `supabase db push`, so production
-- stays empty until a real contributor publishes something.
--
-- Only the course catalogue is seeded: assignments require a real
-- auth.users row, and fabricating users would make RLS tests meaningless.
INSERT INTO
  public.courses (name, code, department)
VALUES
  ('Database Systems', 'IF2230', 'Informatics'),
  ('Algorithms and Data Structures', 'IF2211', 'Informatics'),
  ('Software Engineering', 'IF2210', 'Informatics'),
  ('Operating Systems', 'IF2232', 'Informatics'),
  ('Linear Algebra', 'MA1101', 'Mathematics'),
  ('Academic Writing', 'KU1021', 'General Studies')
ON CONFLICT (normalized_name) DO NOTHING;
