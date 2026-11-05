# SECURITY DEFINER Audit — 143 functions (Phase 3)

Evidence: inventory `SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE pronamespace='public' AND prosecdef ORDER BY proname` (all 143 names+signature strings captured, 3 batches of 60/60/23); `proconfig` check; spot `pg_get_functiondef` for `is_class_member`, `can_manage_class`, `can_view_leave_request`, `can_view_session`; dynamic-SQL scan `pg_get_functiondef LIKE '%EXECUTE%'`.

## Inventory verdict

- Total SECURITY DEFINER functions in `public`: **143** (159 functions total, 16 non-definer — e.g. `set_updated_at` trigger helpers).
- All 143 have `proconfig` set; `with_path` count = **143/143** — every SECURITY DEFINER function declares a `search_path`. No function missing `search_path` (query for `prosecdef AND proconfig IS NULL` returned empty).
- Dynamic SQL (`EXECUTE`): **1 function** — `rls_auto_enable`. Internal RLS helper; body not line-verified this phase → **NOT VERIFIED** for injection surface. Everything else: no `EXECUTE` found.
- Full `pg_get_functiondef` bodies for all 143: **NOT VERIFIED** (only signature list + 4 spot bodies captured). This audit is **INCOMPLETE** by design — no function body was altered; body-level review is staged to Phase 4 with staging fixtures.

## Prioritized review (academic-record mutators first)

| Priority | Functions | Review performed | Finding |
|---|---|---|---|
| Auth helpers | `is_class_member`, `is_class_admin`, `is_platform_admin`, `can_manage_class`, `can_organize_class_sessions`, `can_view_session`, `can_view_leave_request`, `can_review_leave_request`, `can_view_class_verification`, `can_edit_class_verification`, `is_leave_request_owner`, `is_class_verification_owner`, `session_class_id`, `leave_request_class_id` | Spot bodies verified: all bind `auth.uid()` server-side, `SET search_path` present, no dynamic SQL. | **No issue found** in spot check. `can_view_leave_request` uses `search_path='public','pg_temp'` (see RLS note P2). |
| Attendance write path | `check_in_attendance_meeting`, `check_in_discussion_session`, `record_attendance_correction`, `open_/close_/reopen_attendance_meeting`, `create_attendance_meeting`, `update_attendance_meeting_location`, `clear_discussion_session_checkin_location`, `record_discussion_session_checkin`, `review_discussion_session_checkin`, `attendance_meeting_roster/failures`, `class_attendance_*`, `session_attendance`, `session_checkin_summary` | Signatures inspected only (bodies NOT VERIFIED). Prior checkpoint: 10-minute late rule + `joined_at <= starts_at` guard in `check_in_attendance_meeting`; `record_attendance_correction` requires `physically_verified=true` for present — consistent with Phase 1 backfill decisions. | Signature-level: no unsigned/ambiguous overload besides two `check_in_*` variants (with/without `p_captured_at`). **Body review pending Phase 4.** |
| Leave workflow | `create_leave_request`, `cancel/submit/update_leave_request`, `review_leave_request`, `record_leave_lecturer_outcome`, `set_leave_request_subjects`, `record_leave_request_ocr`, `confirm_leave_request_ocr`, `add/remove_leave_request_evidence`, `complete_leave_forwarding` | Signatures only. | No dynamic SQL; evidence path bound in RLS. **Body review pending.** |
| Class lifecycle | `delete_class`, `delete_class_subject`, `assign/revoke_class_admin`, `become_class_representative`, `remove_class_member`, `join_class_by_name`, `create_/revoke_/accept_/decline_class_invitation`, `accept_pending_invitation`, `get_invitation_preview`, `set_class_join_policy`, `set_class_status`, `update_class_metadata/subject`, `create_class_subject`, `delete_*`, `apply_for_class`, `decide_class_application/verification`, `begin/submit/revise/discard_class_verification` | Signatures only. | `delete_class`/`delete_class_subject` are destructive-surface RPCs — must require `can_manage_class` + confirmation in Phase 4 test plan. **Bodies NOT VERIFIED.** |
| Assignment | `submit/publish/revise_class_assignment`, `review_class_assignment`, `review_public_assignment`, `moderate_assignment`, `report_assignment`, `review_assignment_report`, `record_assignment_revision`, `remove_assignment_attachment` | Signatures only. | **Bodies NOT VERIFIED.** |
| Notification/queue | `claim_notification_events/deliveries`, `claim_session_reminders`, `complete_notification_event/delivery`, `complete_session_reminder`, `enqueue_notification_event`, `queue_session_notification`, `notify_class_leave_reviewers`, `notify_session_participants`, `notify_platform_admins_public_assignment` | Signatures only. | Service-role/cron callers assumed; execution grants (EXECUTE privileges per role) **NOT VERIFIED** — Phase 4 must dump `has_function_privilege`. |
| Platform/ops | `developer_*`, `list_platform_*`, `get_platform_admin_overview`, `consume_rate_limit`, `register_push_subscription`, `delete_push_subscription`, `purge_discussion_checkin_coordinates`, `purge_notification_deliveries`, `log_attendance_export/verification`, `record_audit`, `enforce_class_admin_cap`, `create_or_get_course`, `find_class_duplicates`, `get_class_dependencies`, `set_class_media`, `set_my_*`, `update_my_*` | Signatures only. | `rls_auto_enable` is the sole dynamic-SQL function (see above). `developer_*` must assert `is_platform_admin()` — **grant + body NOT VERIFIED**. |

## Cross-class / cross-tenant

- Signature review shows every mutator takes `p_class_id` / `p_session_id` / `p_request_id` / `p_assignment_id` and is expected to call `is_class_member`/`can_manage_class`/`can_view_*` internally. That internal check was verified only for the auth helpers; per-function internal-check verification is **INCOMPLETE** — Phase 4 staging tests must attempt each mutator with a foreign `p_class_id` and expect denial.
- No function accepts a `university_id` (no tenant column exists) — cross-tenant question is currently moot, and becomes P0 when tenant lands.

## Status

- Inventory (names, signatures, counts, search_path, dynamic SQL): **VERIFIED**.
- Auth-helper bodies (4 spot checks): **VERIFIED**.
- Remaining ~139 function bodies + EXECUTE grants + `rls_auto_enable` internals: **NOT VERIFIED / INCOMPLETE**. Never mark this audit complete until Phase 4 closes them.
