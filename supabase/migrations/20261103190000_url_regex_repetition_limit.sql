-- Postgres refuses a regex repetition bound above 255, so `[^[:space:]]{8,2048}` is
-- not a loose bound but an invalid expression. A `~` pattern is only compiled when
-- it is first evaluated, so both constraints were accepted at migration time and
-- then failed every write with SQLSTATE 2201B: a Drive link or a course material
-- link could never be saved, and the form could only answer "Something went wrong".
-- The shape rule is unchanged: `https://`, at least 8 further characters (16 in
-- total), no whitespace. The 2,048 ceiling moves to `char_length`, which also
-- matches the maximum the forms already validate, so the database no longer rejects
-- a link that the request was accepted for.
ALTER TABLE public.assignments
DROP CONSTRAINT IF EXISTS assignments_drive_url_https;


ALTER TABLE public.assignments
ADD CONSTRAINT assignments_drive_url_https CHECK (
  drive_url IS NULL
  OR (
    drive_url ~ '^https://[^[:space:]]+$'
    AND char_length(drive_url) BETWEEN 16 AND 2048
  )
);


ALTER TABLE public.course_materials
DROP CONSTRAINT IF EXISTS course_materials_url_https;


ALTER TABLE public.course_materials
ADD CONSTRAINT course_materials_url_https CHECK (
  resource_url IS NULL
  OR (
    resource_url ~ '^https://[^[:space:]]+$'
    AND char_length(resource_url) BETWEEN 16 AND 2048
  )
);
