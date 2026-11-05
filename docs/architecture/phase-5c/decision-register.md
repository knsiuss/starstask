# Phase 5C — Decision Register

- D-01 academic_years/semesters: university-owned, status planned/open/closed/archived, one current year per university (partial unique). Entry Year stays on identities/classes independently (ADR-004).
- D-02 classes evolve additively: nullable university_id/academic_unit_id/academic_year_id/semester_id/entry_year/code + composite same-university FKs. No NOT NULL flip (would break existing rows); contract step deferred.
- D-03 courses catalogue scope UNRESOLVED: nullable university_id, no scope enforcement.
- D-04 offerings/enrollments triad per 26-G: composite tenant FKs; enrollments separate so retake never mutates home class.
- D-05 schedules: new rules/instances/exceptions; legacy class_course_schedules untouched. Timezone per rule (snapshot), no PDF inference.
