# Phase 5E — Migration Validation Report

Piped psql applied. Validation SQL PASS: not_applicable rejected by CHECK (display-only preserved), present accepted, validate_grade_entry(80,100)=true and (120,100)=false. RLS/anon as 5C. tsc/vitest 1079/1079/eslint PASS. Rollback: drop grade_history→entries→batches, corrections→records→meetings, drop added columns.
