# Phase 5E — Decision Register

- D-01 assignments/course_materials gain nullable university_id/offering_id (additive; existing class_id/subject_id behavior preserved).
- D-02 attendance: new meetings/records/corrections (append-only corrections, 5-status CHECK); legacy discussion_sessions/checkins untouched. No late-threshold constant invented.
- D-03 grading: batches/entries/history infra + validate_grade_entry helper only; CSV column mapping UNRESOLVED → no importer, no publishing invented.
- D-04 storage: no bucket/policy change; private evidence stays private; no duplicates created.
