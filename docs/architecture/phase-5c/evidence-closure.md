# Phase 5C — Evidence Closure

Verified in this session: 5A (`20261111000000`) and 5B (`20261112000000`) migrations present in git/worktree and applied in local DB (56 tables pre-5C). `classes` (20261029000900) has slug/name/description/course_id/semester/academic_year/status (draft/active/archived) — no university FK. `class_subjects`/`class_course_schedules` (20261102110000) preserved. Entry Year independent per ADR-004; catalogue scope UNRESOLVED (36#2) so `courses.university_id` nullable. No PDF import (no evidence). Schedule precedent: weekly rows with day 1–7, wall-clock `time`, room.
