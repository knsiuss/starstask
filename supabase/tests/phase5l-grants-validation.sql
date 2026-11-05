-- Phase 5L: SECDEF grants + search_path + audit immutability validation.
-- Run ONLY on disposable local/staging database. Never on production.
-- Idempotent: safe to re-run.

-- 1. No state-changing RPC should be EXECUTE-able by anon.
SELECT 'anon_execute_on_write_rpc' AS check_name, count(*) AS violations
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND grantee = 'anon'
  AND routine_name IN (
    'apply_for_class','decide_class_application','create_class_invitation',
    'revoke_class_invitation','accept_class_invitation','accept_pending_invitation',
    'assign_class_admin','revoke_class_admin','remove_class_member',
    'set_class_status','update_class_metadata','delete_class',
    'create_class_subject','update_class_subject','delete_class_subject',
    'submit_class_assignment','review_class_assignment','moderate_assignment',
    'review_public_assignment','create_discussion_session','update_discussion_session',
    'rsvp_discussion_session','check_in_discussion_session',
    'create_attendance_meeting','open_attendance_meeting','close_attendance_meeting',
    'check_in_attendance_meeting','record_attendance_correction',
    'create_leave_request','update_leave_request','submit_leave_request',
    'review_leave_request','add_leave_request_evidence',
    'begin_class_verification','decide_class_verification',
    'update_my_profile','update_my_bio','set_my_avatar_url','join_class_by_name',
    'set_class_media','register_push_subscription','delete_push_subscription',
    'list_platform_users','list_platform_classes','get_platform_admin_overview',
    'get_my_profile','is_platform_admin','is_class_member','is_class_admin',
    'can_manage_class','is_university_member','has_class_permission'
  );

-- 2. Intentionally public helpers MUST still be callable by anon.
SELECT routine_name, grantee FROM information_schema.role_routine_grants
WHERE routine_schema = 'public' AND grantee = 'anon'
  AND routine_name IN ('get_invitation_preview','list_discussion_sessions','consume_rate_limit','assignment_id_from_object_path');

-- 3. All SECDEF functions should have a safe search_path ('' or public without pg_temp).
SELECT p.proname, coalesce(array_to_string(p.proconfig, ','),'NULL') AS cfg
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = true
  AND array_to_string(p.proconfig, ',') LIKE '%pg_temp%';

-- 4. audit_logs: authenticated must have SELECT (column) but no INSERT/UPDATE/DELETE grants.
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'audit_logs'
  AND grantee = 'authenticated'
ORDER BY privilege_type;

-- 5. audit_logs trigger must exist.
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'audit_logs_prevent_mutation_trg';

-- 6. course_invite_tokens policy must be admin-only now.
SELECT policyname, cmd, roles::text, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'course_invite_tokens';
