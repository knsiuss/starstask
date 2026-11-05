# Phase 5E — Implementation

Migration: `supabase/migrations/20261115000000_ops.sql`. New: attendance_meetings, attendance_records, attendance_corrections (append-only grants), grade_batches, grade_entries, grade_history. Evolved: assignments, course_materials (+university_id/offering_id). Helper: validate_grade_entry(numeric,numeric). RLS member-read; corrections/history append-only (SELECT grant only).
