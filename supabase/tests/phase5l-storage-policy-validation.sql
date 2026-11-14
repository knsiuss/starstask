-- Phase 5L: Storage policy evaluation (live) — disposable DB only.
-- Simulates PostgREST via SET ROLE + JWT claim. No real file bytes uploaded;
-- evaluates storage.objects RLS (the same policies the Storage API enforces).
-- Fixture: two synthetic classes A/B with admin users; one object per class.
-- classes need a course FK + several NOT NULL cols.
-- Non-transactional + idempotent (WHERE NOT EXISTS) so one conflict cannot abort the rest.
INSERT INTO
  public.courses (id, name, code)
SELECT
  '00000000-0000-4000-8000-0000000052c1',
  'Phase5L Course',
  'P5L001'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.courses
    WHERE
      id = '00000000-0000-4000-8000-0000000052c1'
  );


INSERT INTO
  public.classes (
    id,
    slug,
    name,
    description,
    course_id,
    course_name,
    semester,
    academic_year,
    status
  )
SELECT
  '00000000-0000-4000-8000-0000000052a1',
  'phase5l-class-a',
  'Phase5L Class A',
  'Synthetic class A for storage policy test.',
  '00000000-0000-4000-8000-0000000052c1',
  'Phase5L Course',
  '2026-1',
  '2026/2027',
  'active'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.classes
    WHERE
      id = '00000000-0000-4000-8000-0000000052a1'
  );


INSERT INTO
  public.classes (
    id,
    slug,
    name,
    description,
    course_id,
    course_name,
    semester,
    academic_year,
    status
  )
SELECT
  '00000000-0000-4000-8000-0000000052b1',
  'phase5l-class-b',
  'Phase5L Class B',
  'Synthetic class B for storage policy test.',
  '00000000-0000-4000-8000-0000000052c1',
  'Phase5L Course',
  '2026-1',
  '2026/2027',
  'active'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.classes
    WHERE
      id = '00000000-0000-4000-8000-0000000052b1'
  );


-- class_admins FK requires the admin to already be a member.
INSERT INTO
  public.class_members (class_id, user_id)
SELECT
  '00000000-0000-4000-8000-0000000052a1',
  '00000000-0000-4000-8000-0000000051a2'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.class_members
    WHERE
      class_id = '00000000-0000-4000-8000-0000000052a1'
      AND user_id = '00000000-0000-4000-8000-0000000051a2'
  );


INSERT INTO
  public.class_members (class_id, user_id)
SELECT
  '00000000-0000-4000-8000-0000000052a1',
  '00000000-0000-4000-8000-0000000051a3'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.class_members
    WHERE
      class_id = '00000000-0000-4000-8000-0000000052a1'
      AND user_id = '00000000-0000-4000-8000-0000000051a3'
  );


INSERT INTO
  public.class_members (class_id, user_id)
SELECT
  '00000000-0000-4000-8000-0000000052b1',
  '00000000-0000-4000-8000-0000000051b2'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.class_members
    WHERE
      class_id = '00000000-0000-4000-8000-0000000052b1'
      AND user_id = '00000000-0000-4000-8000-0000000051b2'
  );


INSERT INTO
  public.class_admins (class_id, user_id)
SELECT
  '00000000-0000-4000-8000-0000000052a1',
  '00000000-0000-4000-8000-0000000051a3'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.class_admins
    WHERE
      class_id = '00000000-0000-4000-8000-0000000052a1'
      AND user_id = '00000000-0000-4000-8000-0000000051a3'
  );


-- --- Objects (class-media, class-scoped paths) ---
INSERT INTO
  storage.objects (bucket_id, name)
SELECT
  'class-media',
  '00000000-0000-4000-8000-0000000052a1/a.png'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      storage.objects
    WHERE
      bucket_id = 'class-media'
      AND name = '00000000-0000-4000-8000-0000000052a1/a.png'
  );


INSERT INTO
  storage.objects (bucket_id, name)
SELECT
  'class-media',
  '00000000-0000-4000-8000-0000000052b1/b.png'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      storage.objects
    WHERE
      bucket_id = 'class-media'
      AND name = '00000000-0000-4000-8000-0000000052b1/b.png'
  );


-- S1: A-admin can read BOTH objects (class-media read is intentionally public)
SET ROLE authenticated;


SET
  request.jwt.claim.sub = '00000000-0000-4000-8000-0000000051a3';


SELECT
  'S1 expected ALLOW public read (2 rows)' AS test,
  count(*) AS actual_rows
FROM
  storage.objects
WHERE
  bucket_id = 'class-media'
  AND (
    name = '00000000-0000-4000-8000-0000000052a1/a.png'
    OR name = '00000000-0000-4000-8000-0000000052b1/b.png'
  );


-- S2: B-admin DELETE A object -> DENY (0 rows deleted)
DO $$
DECLARE v_n int;
BEGIN
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'class-media'
      AND name = '00000000-0000-4000-8000-0000000052a1/a.png';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE NOTICE 'S2 PASS: delete blocked, 0 rows changed';
    ELSE RAISE NOTICE 'S2 FAIL: delete changed % rows', v_n; END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'S2 PASS: delete blocked with error (%)', SQLERRM;
  END;
END $$;


-- S3: Anonymous can read class-media (intentional public asset) but cannot INSERT
RESET ROLE;


SET
  request.jwt.claim.sub = '';


SET ROLE anon;


SELECT
  'S3a expected ALLOW public read (anon)' AS test,
  count(*) AS actual_rows
FROM
  storage.objects
WHERE
  bucket_id = 'class-media'
  AND name LIKE '00000000-0000-4000-8000-0000000052b1/%';


DO $$
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('class-media', '00000000-0000-4000-8000-0000000052b1/anon.png');
    RAISE NOTICE 'S3b FAIL: anon insert unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'S3b PASS: anon insert blocked (%)', SQLERRM;
  END;
END $$;


-- S4: Non-admin member cannot INSERT into class-media (needs class_admins row)
SET ROLE authenticated;


SET
  request.jwt.claim.sub = '00000000-0000-4000-8000-0000000051a2';


DO $$
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('class-media', '00000000-0000-4000-8000-0000000052a1/x.png');
    RAISE NOTICE 'S4 FAIL: non-admin insert unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'S4 PASS: non-admin insert blocked (%)', SQLERRM;
  END;
END $$;


RESET ROLE;


RESET request.jwt.claim.sub;
