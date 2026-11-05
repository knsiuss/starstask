-- Dashboard overview RPC: 8+ queries -> 1 roundtrip (perf, free).
-- Returns JSONB matching DashboardOverview shape (classes, stats, recentTasks, timeZone, nowIso).
-- Logic mirrors getDashboardOverview in apps/web/src/lib/db/dashboard.ts.

CREATE OR REPLACE FUNCTION public.get_dashboard_overview(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text;
  v_now timestamptz := now();
  v_due_start timestamptz;
  v_due_end timestamptz;
  v_new_since timestamptz;
  v_result jsonb;
BEGIN
  SELECT timezone INTO v_tz FROM public.notification_preferences WHERE user_id = p_user_id;
  IF v_tz IS NULL OR v_tz NOT IN ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura','UTC') THEN v_tz := NULL; END IF;
  v_due_start := (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta');
  v_due_end := v_due_start + interval '7 days';
  v_new_since := v_now - interval '7 days';

  SELECT jsonb_build_object(
    'classes', COALESCE(classes_json, '[]'::jsonb),
    'stats', jsonb_build_object(
      'totalTasks', COALESCE((SELECT sum((c->>'task_count')::int) FROM jsonb_array_elements(COALESCE(classes_json,'[]'::jsonb)) c), 0),
      'dueSoon', COALESCE(stats_json->>'dueSoon', '0')::int,
      'pastDeadline', COALESCE(stats_json->>'pastDeadline', '0')::int,
      'classCount', COALESCE(jsonb_array_length(classes_json), 0),
      'newThisWeek', COALESCE(stats_json->>'newThisWeek', '0')::int
    ),
    'recentTasks', COALESCE(recent_json, '[]'::jsonb),
    'timeZone', v_tz,
    'nowIso', v_now
  ) INTO v_result
  FROM (
    SELECT
      (SELECT jsonb_agg(row_to_json(t) ORDER BY t.name) FROM (
        SELECT cl.id, cl.slug, cl.name, cl.course_name, cl.semester, cl.academic_year,
          (SELECT count(*) FROM public.assignments a WHERE a.class_id=cl.id AND a.status='published') +
          (SELECT count(*) FROM public.assignments a JOIN public.class_subjects cs ON cs.class_id=cl.id AND cs.course_id=a.course_id WHERE a.class_id IS NULL AND a.subject_id IS NULL AND a.status='published') AS task_count,
          EXISTS (SELECT 1 FROM public.class_admins ca WHERE ca.class_id=cl.id AND ca.user_id=p_user_id) AS is_admin,
          (SELECT count(*) FROM public.class_subjects cs WHERE cs.class_id=cl.id) AS subject_count,
          NULL::text AS admin_name
        FROM public.classes cl JOIN public.class_members m ON m.class_id=cl.id AND m.user_id=p_user_id
        WHERE cl.status='active'
      ) t) AS classes_json,
      (SELECT jsonb_build_object(
        'dueSoon', (SELECT count(*) FROM public.assignments a JOIN public.class_members m ON m.class_id=a.class_id AND m.user_id=p_user_id WHERE a.status='published' AND a.deadline >= v_due_start AND a.deadline < v_due_end),
        'pastDeadline', (SELECT count(*) FROM public.assignments a JOIN public.class_members m ON m.class_id=a.class_id AND m.user_id=p_user_id WHERE a.status='published' AND a.deadline < v_due_start),
        'newThisWeek', (SELECT count(*) FROM public.assignments a JOIN public.class_members m ON m.class_id=a.class_id AND m.user_id=p_user_id WHERE a.status='published' AND a.published_at >= v_new_since)
      )) AS stats_json,
      (SELECT jsonb_agg(row_to_json(r) ORDER BY r.published_at DESC) FROM (
        SELECT a.id, a.title, a.deadline, cl.name AS class_name, a.published_at
        FROM public.assignments a JOIN public.classes cl ON cl.id=a.class_id JOIN public.class_members m ON m.class_id=cl.id AND m.user_id=p_user_id
        WHERE a.status='published' ORDER BY a.published_at DESC NULLS LAST LIMIT 5
      ) r) AS recent_json
  ) s;
  RETURN v_result;
END; $$;

REVOKE ALL ON FUNCTION public.get_dashboard_overview (uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_overview (uuid) TO authenticated;
COMMENT ON FUNCTION public.get_dashboard_overview (uuid) IS 'Dashboard overview in 1 roundtrip: classes+stats+recent. Mirrors lib/db/dashboard.ts logic (scoped tasks only, public course tasks counted in app layer).';
