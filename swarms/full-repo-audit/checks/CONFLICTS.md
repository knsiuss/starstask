# Cross-Task Conflicts & Discrepancies

1. **Column name typo in `outputs/T4.md` Finding 5 (`access_scope` vs `course_scope`):**
   - `outputs/T1.md` (lines 12, 24) and `supabase/migrations/20270124000000_retake_course_access_scope.sql#L11` correctly name the column `class_members.course_scope`.
   - `outputs/T4.md` (lines 86, 89) refers to `class_members.access_scope`. The underlying finding (mobile lacks retake course-access management and course-scoped invitation support) is valid, but `FINAL.md` should use the exact column name `course_scope`.

No other cross-task contradictions found across `T1.md`, `T2.md`, `T3.md`, and `T4.md`.
