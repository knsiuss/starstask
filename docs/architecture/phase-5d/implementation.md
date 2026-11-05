# Phase 5D — Implementation

Migration: `supabase/migrations/20261114000000_enrollment_admin.sql`. New: class_memberships, course_invite_tokens, course_invite_acceptances, class_admin_assignments, class_admin_permissions. RPC/helper: has_class_permission(uuid,text) SECURITY DEFINER search_path=''. Last-admin guard trigger. RLS member-read; invites metadata readable by university members (hashes only, never raw tokens). No app code changed.
