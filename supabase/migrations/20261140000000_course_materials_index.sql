-- course_materials is listed by (class_id, subject_id) newest-first
-- (course-materials.ts: .eq("class_id").eq("subject_id")
-- .order("created_at", descending).limit(100)), but neither FK leads an
-- index, so the list scans the table as materials grow.
CREATE INDEX IF NOT EXISTS course_materials_class_subject_created_idx ON public.course_materials (class_id, subject_id, created_at DESC);
